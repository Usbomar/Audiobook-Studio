"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Block } from "@/store/types";

interface DeleteBlockDialogProps {
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteBlockDialog({
  block,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteBlockDialogProps) {
  const hasRecording = block && block.status !== "empty";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Esborrar capítol</DialogTitle>
          <DialogDescription>
            {block ? (
              <>
                Vols esborrar <strong>{block.title}</strong>?
                {hasRecording
                  ? " La gravació i les edicions associades s'eliminaran permanentment."
                  : " Aquesta acció no es pot desfer."}
              </>
            ) : (
              "Selecciona un capítol per esborrar."
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel·lar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!block || isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? "Esborrant…" : "Esborrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
