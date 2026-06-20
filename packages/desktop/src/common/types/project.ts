/**
 * Tipos del módulo Proyectos (Alinea Fase 2 #2). Espejo de los modelos del Core
 * (Rust): projects, tasks, artifacts, handoffs, plantillas y ACL de membresía.
 * Los timestamps son epoch en milisegundos (number).
 */

export type TProjectStatus = 'active' | 'archived';
export type TAssigneeKind = 'human' | 'agent';
export type TTaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'rejected' | 'blocked';
export type TTaskAction = 'start' | 'submit' | 'approve' | 'reject' | 'reopen';
export type TProjectPerm = 'read' | 'write' | 'owner';

export interface TProject {
  id: string;
  name: string;
  description: string | null;
  project_type: string;
  status: TProjectStatus;
  created_by: string;
  created_at: number;
  updated_at: number;
}

/** Una entrada de `resource_acl` (miembro de un proyecto). */
export interface TProjectMember {
  id: string;
  resource_type: string;
  resource_id: string;
  principal_type: string;
  principal_id: string;
  perm: TProjectPerm;
  created_at: number;
}

export interface TPipelineTemplate {
  id: string;
  name: string;
  project_type: string;
  version: number;
  definition: string;
  is_active: boolean;
  created_at: number;
}

export interface TTask {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  instructions: string | null;
  assignee_kind: TAssigneeKind;
  assignee_id: string | null;
  status: TTaskStatus;
  requires_human_review: boolean;
  produces_artifact: string | null;
  order_index: number;
  conversation_id: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export interface TTaskArtifact {
  id: string;
  task_id: string;
  kind: string;
  uri: string;
  title: string;
  produced_by: string;
  created_at: number;
}

export interface TTaskHandoff {
  id: string;
  task_id: string;
  from_status: string | null;
  to_status: string;
  actor: string;
  trigger_kind: string;
  note: string | null;
  created_at: number;
}

export interface TCreateProjectParams {
  name: string;
  description?: string;
  project_type?: string;
}

export interface TCreateTaskParams {
  project_id: string;
  title: string;
  instructions?: string;
  parent_task_id?: string;
  assignee_kind?: TAssigneeKind;
  assignee_id?: string;
  requires_human_review?: boolean;
  produces_artifact?: string;
  order_index?: number;
  depends_on?: string[];
}
