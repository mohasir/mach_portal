import { env } from '@/env';

export function Copyright() {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-3 text-center">
      <span className="text-caption text-muted">
        v{env.NEXT_PUBLIC_APP_VERSION} · {env.NEXT_PUBLIC_APP_COMMIT}
      </span>
      <span className="text-caption text-muted">
        © {new Date().getFullYear()} Oravitech, todos los derechos reservados
      </span>
    </div>
  );
}
