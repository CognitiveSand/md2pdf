// These byte buffers are synthetic first-party test fixtures. They are not
// vendored assets and do not select or embed third-party artifacts.
export function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}

export function tinyJpeg(): Buffer {
  return Buffer.from(
    [
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////",
      "////////////////////////////////////////////////////2wBDAf//////////////",
      "////////////////////////////////////////////////////////wAARCAABAAEDASIA",
      "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/",
      "9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAU",
      "EQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA",
      "/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEA",
      "AAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAA",
      "AAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIB",
      "AT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z",
    ].join(""),
    "base64",
  );
}

export function tinyWebp(): Buffer {
  return Buffer.from(
    "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=",
    "base64",
  );
}

export function deceptiveImageBytes(): Buffer {
  return Buffer.from("not an image", "utf8");
}

export function syntheticOversizedImageBytes(byteLength: number): Buffer {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError("byteLength must be a non-negative safe integer");
  }

  return Buffer.alloc(byteLength, 0x61);
}
