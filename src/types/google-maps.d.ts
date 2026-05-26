// Ambient declarations for Google Maps JS API loaded at runtime via script tag.
declare namespace google.maps {
  type LatLngLiteral = any;
  type Map = any;
  type Marker = any;
  type MapOptions = any;
  type MarkerOptions = any;
  type MapMouseEvent = any;
  type LatLng = any;
  namespace places {
    type Autocomplete = any;
    type AutocompleteOptions = any;
    type PlaceResult = any;
  }
  namespace event {
    function clearInstanceListeners(instance: any): void;
  }
}

declare var google: any;
