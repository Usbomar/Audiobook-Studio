"use client";

import { useEffect, useState } from "react";
import {
  shouldShowWelcome,
  WelcomeScreen,
} from "@/components/welcome/welcome-screen";

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    setShowWelcome(shouldShowWelcome());
  }, []);

  if (showWelcome) {
    return <WelcomeScreen onStart={() => setShowWelcome(false)} />;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Audiobook Studio
      </h1>
      <p className="max-w-md text-muted-foreground">
        Selecciona un capítol a la barra lateral o crea un projecte nou per
        començar a gravar.
      </p>
    </div>
  );
}
