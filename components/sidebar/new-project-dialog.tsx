"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void;
  title?: string;
  submitLabel?: string;
  placeholder?: string;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  title = "Nou projecte",
  submitLabel = "Crear",
  placeholder = "Títol del llibre",
}: NewProjectDialogProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel·lar
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
