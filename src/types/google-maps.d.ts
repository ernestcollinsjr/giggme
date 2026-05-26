// Ambient declaration for the global `google.maps` namespace loaded via script tag.
declare namespace google {
  namespace maps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type LatLngLiteral = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Map = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Marker = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type MapOptions = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type MarkerOptions = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type MapMouseEvent = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type LatLng = any;
    namespace places {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type Autocomplete = any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type AutocompleteOptions = any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type PlaceResult = any;
    }
    namespace event {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function clearInstanceListeners(instance: any): void;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;
