declare module "heic-convert" {
  function heicConvert(opts: {
    buffer: Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  }): Promise<ArrayBuffer>;
  export = heicConvert;
}
