type SaveFilePickerWindow = Window & {
  showSaveFilePicker: (options: {
    suggestedName: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

export async function saveBlobWithPicker(
  blob: Blob,
  suggestedName: string,
  mimeType?: string
): Promise<"picker" | "download"> {
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const extension = suggestedName.split(".").pop() ?? "bin";
      const handle = await (
        window as unknown as SaveFilePickerWindow
      ).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "Fitxer d'àudio",
            accept: {
              [mimeType ?? (blob.type || "application/octet-stream")]: [
                `.${extension}`,
              ],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "picker";
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return "download";
}

export async function saveZipWithPicker(
  blob: Blob,
  suggestedName: string
): Promise<"picker" | "download"> {
  return saveBlobWithPicker(blob, suggestedName, "application/zip");
}
