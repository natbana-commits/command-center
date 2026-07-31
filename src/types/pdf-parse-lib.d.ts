// pdf-parse's package "main" (index.js) has a buggy self-test that misfires
// when bundled by esbuild (see src/drive/content.ts) — we import its actual
// implementation directly instead, which has no bundled type declarations.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
  }

  export default function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
}
