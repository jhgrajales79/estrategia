import type { ComponentType } from "react";
import type { ActivityType } from "@/lib/types";
import type { ActivityComponentProps } from "./shared";
import NotasColectivas from "./NotasColectivas";
import MatrizPonderada from "./MatrizPonderada";
import MatrizCuadrantes from "./MatrizCuadrantes";
import RuedaEvaluacion from "./RuedaEvaluacion";
import VotacionFichas from "./VotacionFichas";
import TarjetaEstructurada from "./TarjetaEstructurada";
import MapaEstrategico from "./MapaEstrategico";
import TableroProyectos from "./TableroProyectos";
import FichaKPI from "./FichaKPI";

export const ACTIVITY_COMPONENTS: Record<ActivityType, ComponentType<ActivityComponentProps>> = {
  notas: NotasColectivas,
  matriz_ponderada: MatrizPonderada,
  matriz_cuadrantes: MatrizCuadrantes,
  rueda_evaluacion: RuedaEvaluacion,
  votacion_fichas: VotacionFichas,
  tarjeta_estructurada: TarjetaEstructurada,
  mapa_estrategico: MapaEstrategico,
  tablero_proyectos: TableroProyectos,
  ficha_kpi: FichaKPI,
  checklist_salidas: TarjetaEstructurada,
};

export type { ActivityComponentProps } from "./shared";
