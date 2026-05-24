export default function Home() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Audiobook Studio
      </h1>
      <p className="max-w-md text-muted-foreground">
        Selecciona un bloc a la barra lateral o crea un projecte nou per
        començar a gravar.
      </p>
    </div>
  );
}
