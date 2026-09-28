import { fmtMoney } from "@/lib/format";
import { getStats } from "@/lib/queries";
import { Stat, Stats } from "@/components/page-header";

export async function StatsGenerales() {
  const s = await getStats();
  return (
    <Stats>
      <Stat valor={s.total} label="Pedidos totales" />
      <Stat valor={s.enCurso} label="En curso" />
      <Stat valor={fmtMoney(s.gastoMes)} label="Gasto este mes" mono />
      <Stat valor={s.alertas} label="Necesitan atención" tono={s.alertas ? "alerta" : undefined} />
    </Stats>
  );
}
