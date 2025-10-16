import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

const MAX_IMAGE_DIMENSION = 1024;

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  return { width, height };
}

export const detectFaceAndCrop = async (imageElement: HTMLImageElement, targetSize: number): Promise<Blob> => {
  try {
    console.log('Starting face detection and cropping...');
    
    // Create canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    const { width, height } = resizeImageIfNeeded(canvas, ctx, imageElement);
    console.log(`Image dimensions: ${width}x${height}`);
    
    // Get image data as base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Use object detection to find faces
    console.log('Detecting faces...');
    const detector = await pipeline('object-detection', 'Xenova/detr-resnet-50', {
      device: 'webgpu',
    });
    
    const results = await detector(imageData);
    console.log('Detection results:', results);
    
    // Find person/face in results
    const person = results.find((r: any) => 
      r.label === 'person' && r.score > 0.5
    ) as any;
    
    let cropX = 0;
    let cropY = 0;
    let cropSize = Math.min(width, height);
    
    if (person && person.box) {
      console.log('Face detected:', person);
      
      // Center crop on the detected person
      const centerX = (person.box.xmin + person.box.xmax) / 2;
      const centerY = (person.box.ymin + person.box.ymax) / 2;
      
      // Calculate crop area centered on face
      const faceWidth = person.box.xmax - person.box.xmin;
      const faceHeight = person.box.ymax - person.box.ymin;
      cropSize = Math.max(faceWidth, faceHeight) * 2; // 2x face size for context
      cropSize = Math.min(cropSize, Math.min(width, height));
      
      cropX = Math.max(0, centerX - cropSize / 2);
      cropY = Math.max(0, centerY - cropSize / 2);
      
      // Adjust if crop goes out of bounds
      if (cropX + cropSize > width) cropX = width - cropSize;
      if (cropY + cropSize > height) cropY = height - cropSize;
    } else {
      console.log('No face detected, centering image');
      // Center crop if no face detected
      cropX = (width - cropSize) / 2;
      cropY = (height - cropSize) / 2;
    }
    
    // Create output canvas with target size
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetSize;
    outputCanvas.height = targetSize;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    // Draw cropped and scaled image
    outputCtx.drawImage(
      canvas,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      targetSize,
      targetSize
    );
    
    console.log('Face-centered crop complete');
    
    // Convert to blob
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.95
      );
    });
  } catch (error) {
    console.error('Error in face detection:', error);
    // Fallback to center crop
    return centerCropImage(imageElement, targetSize);
  }
};

// Fallback: simple center crop
export const centerCropImage = async (imageElement: HTMLImageElement, targetSize: number): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');
  
  const { width, height } = resizeImageIfNeeded(canvas, ctx, imageElement);
  
  const cropSize = Math.min(width, height);
  const cropX = (width - cropSize) / 2;
  const cropY = (height - cropSize) / 2;
  
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = targetSize;
  outputCanvas.height = targetSize;
  const outputCtx = outputCanvas.getContext('2d');
  
  if (!outputCtx) throw new Error('Could not get output canvas context');
  
  outputCtx.drawImage(
    canvas,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    targetSize,
    targetSize
  );
  
  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/jpeg',
      0.95
    );
  });
};

export const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
