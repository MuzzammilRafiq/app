declare module "heic2any" {
  interface ConversionOptions {
    blob: Blob | File;
    toType: string;
    quality?: number;
  }

  function heic2any(options: ConversionOptions): Promise<Blob | Blob[]>;
  export default heic2any;
}
