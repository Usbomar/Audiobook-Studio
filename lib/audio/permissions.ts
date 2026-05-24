export function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Has denegat l'accés al micròfon. Permet el micròfon a la configuració del navegador i torna-ho a provar.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No s'ha detectat cap micròfon. Connecta'n un i refresca la pàgina.";
      case "NotReadableError":
      case "TrackStartError":
        return "El micròfon està en ús per una altra aplicació. Tanca-la i torna-ho a provar.";
      case "OverconstrainedError":
        return "El micròfon disponible no compleix els requisits sol·licitats.";
      case "SecurityError":
        return "L'accés al micròfon requereix una connexió segura (HTTPS) o localhost.";
      default:
        return error.message || "Error desconegut en accedir al micròfon.";
    }
  }
  if (error instanceof Error) return error.message;
  return "No s'ha pogut accedir al micròfon.";
}
