"use client";

import { BookOpen, Mic, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "audiobook-studio-welcome-dismissed";

export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const steps = [
    {
      icon: BookOpen,
      title: "1. Organitza",
      text: "Crea projectes i blocs (capítols) des de la barra lateral.",
    },
    {
      icon: Mic,
      title: "2. Grava",
      text: "Grava amb el micròfon, VU meter i reducció de soroll IA.",
    },
    {
      icon: Wand2,
      title: "3. Exporta",
      text: "Edita, munta els blocs i exporta en MP3, AAC o FLAC.",
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Benvingut a Audiobook Studio
        </h1>
        <p className="mt-2 text-muted-foreground">
          Estudi professional d&apos;audiollibres al navegador. Tres passos per
          començar:
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.title}
            className="rounded-xl border border-border/60 bg-white p-5 text-center shadow-sm"
          >
            <step.icon className="mx-auto mb-3 size-8 text-sky-600" />
            <h2 className="font-medium">{step.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
          </div>
        ))}
      </div>

      <Button
        size="lg"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          onStart();
        }}
      >
        Començar
      </Button>

      <p className="text-xs text-muted-foreground">
        Dreceres: Espai (play/pause) · R (gravar) · Ctrl+Z (desfer) · Ctrl+S
        (exportar)
      </p>
    </div>
  );
}

export function shouldShowWelcome(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== "1";
}
