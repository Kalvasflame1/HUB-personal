import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/supabase/server";
import { Card, CardTitle, PageHeader, Pill, SkeletonGrid } from "@/components/ui";
import { CopyButton, TokenForm } from "@/components/widget-setup";
import { widgetScript } from "@/lib/widget-script";
import { relative } from "@/lib/format";
import { revokeWidgetToken } from "./actions";

export const metadata: Metadata = { title: "Widget y Apple Watch" };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://hub-personal-tau.vercel.app";

const STEP = "flex gap-3 text-[15px] leading-relaxed";
const NUM = "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent";
const CODE = "rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] break-all";

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={i} className={STEP}><span className={NUM}>{i + 1}</span><div className="min-w-0">{it}</div></li>
      ))}
    </ol>
  );
}

export default function WidgetPage() {
  return (
    <>
      <PageHeader title="Widget y Apple Watch" subtitle="Tu resumen del día en la pantalla de inicio, la de bloqueo y el reloj.">
        <Link href="/mas" className="press flex items-center gap-1 text-[14px] font-medium text-accent">
          <ChevronLeft size={16} aria-hidden /> Más
        </Link>
      </PageHeader>
      <Suspense fallback={<SkeletonGrid blocks={3} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const { supabase } = await getSession();
  const { data } = await supabase.rpc("widget_token_status");
  const status = data?.[0] ?? null;
  const script = widgetScript({ supabaseUrl: SUPABASE_URL, publishableKey: PUBLISHABLE_KEY, appUrl: APP_URL });
  const textUrl = `${SUPABASE_URL}/rest/v1/rpc/widget_text`;

  return (
    <div className="rise grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Card className="lg:col-span-6">
        <CardTitle action={status ? <Pill tone="good">Activa</Pill> : <Pill>Sin clave</Pill>}>1 · Clave del widget</CardTitle>
        <p className="mb-4 text-[15px] text-ink-2">
          El widget y el reloj no inician sesión: usan una clave larga que solo sirve para leer un resumen pequeño
          (preparación, km, número de tareas, seguimiento, eventos de hoy y si hay podcast). No permite cambiar nada.
          {status ? ` Creada ${relative(status.created_at)}${status.last_used_at ? `, usada por última vez ${relative(status.last_used_at)}` : ", aún sin usar"}.` : ""}
        </p>
        <TokenForm hasToken={Boolean(status)} />
        {status ? (
          <form action={revokeWidgetToken} className="mt-3">
            <button type="submit" className="press text-[14px] font-medium text-bad">Revocar la clave</button>
          </form>
        ) : null}
      </Card>

      <Card className="lg:col-span-3">
        <CardTitle>2 · iPhone: widget con Scriptable</CardTitle>
        <Steps
          items={[
            <>Instala <strong>Scriptable</strong> (gratis) desde la App Store.</>,
            <>Copia el script con el botón de abajo. En Scriptable pulsa <strong>+</strong>, pégalo y llámalo «Personal Hub».</>,
            <>Ejecútalo una vez con ▶︎ y pega la clave cuando la pida. Se guarda en el Llavero del iPhone, no en el script.</>,
            <>En la pantalla de inicio o de bloqueo, añade un widget de Scriptable, mantén pulsado → Editar widget → Script: «Personal Hub». Al tocarlo se abre el Hub.</>,
          ]}
        />
        <div className="mt-4 flex items-center gap-3">
          <CopyButton value={script} label="Copiar el script" />
          <span className="text-[13px] text-ink-3">Tamaños: pequeño, mediano y los tres de la pantalla de bloqueo.</span>
        </div>
        <details className="mt-3">
          <summary className="press cursor-pointer text-[14px] font-medium text-accent">Ver el script</summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[12px] leading-snug">{script}</pre>
        </details>
      </Card>

      <Card className="lg:col-span-3">
        <CardTitle>3 · Apple Watch y Siri: atajo «Hub»</CardTitle>
        <Steps
          items={[
            <>En la app Atajos del iPhone crea un atajo llamado <strong>Hub</strong>.</>,
            <>
              Añade <strong>Obtener contenido de URL</strong> con la URL <span className={CODE}>{textUrl}</span>{" "}
              <CopyButton value={textUrl} label="Copiar URL" />
            </>,
            <>
              Despliega la acción: Método <strong>POST</strong>. Cabeceras: <span className={CODE}>apikey</span> con la clave publicable{" "}
              <CopyButton value={PUBLISHABLE_KEY} label="Copiar" /> y <span className={CODE}>Accept</span> con <span className={CODE}>text/plain</span>.
              Cuerpo de la solicitud: <strong>JSON</strong>, campo <span className={CODE}>token</span> con tu clave del widget.
            </>,
            <>Añade <strong>Mostrar resultado</strong> (o <strong>Leer texto</strong> para que Siri lo diga en voz alta).</>,
            <>En los detalles del atajo activa <strong>Mostrar en Apple Watch</strong>. En el reloj puedes ponerlo como complicación de Atajos en la esfera, o decir «Oye Siri, Hub».</>,
          ]}
        />
      </Card>

      <Card className="lg:col-span-6">
        <div className="flex gap-3 text-[14px] text-ink-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p>
            La clave se guarda solo como huella cifrada en Supabase. Si pierdes el iPhone o la compartes por error, revócala aquí:
            el widget y el atajo dejan de funcionar al momento. La clave publicable de Supabase que aparece en el script ya es pública
            (la usa esta misma web) y por sí sola no da acceso a tus datos.
          </p>
        </div>
      </Card>
    </div>
  );
}
