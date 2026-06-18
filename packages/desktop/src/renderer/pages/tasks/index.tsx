/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import alineaMark from '@renderer/assets/logos/brand/alinea-mark.svg';
import { Button, Input } from '@arco-design/web-react';
import { Plus } from '@icon-park/react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Task = { id: string; title: string };
type ColumnId = 'todo' | 'doing' | 'done';
type Board = Record<ColumnId, Task[]>;

const COLUMN_ORDER: ColumnId[] = ['todo', 'doing', 'done'];

// Local seed (preview). Persistence is a backend concern — see docs/prds/alinea/fase2.
const INITIAL_BOARD: Board = {
  todo: [
    { id: 't1', title: 'Cotización RFQ — Cliente DC' },
    { id: 't2', title: 'BOM HVAC sala de servidores' },
  ],
  doing: [{ id: 't3', title: 'Memoria técnica eléctrica' }],
  done: [{ id: 't4', title: 'Levantamiento en sitio' }],
};

let cardSeq = 100;

const TaskCard: React.FC<{ task: Task; overlay?: boolean }> = ({ task, overlay }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'card' },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`task-card-${task.id}`}
      className={`select-none rounded-10px border border-solid border-[var(--color-border-2)] bg-base p-10px text-13px text-t-primary leading-18px cursor-grab active:cursor-grabbing ${overlay ? 'shadow-lg' : 'hover:border-[var(--brand)]'}`}
    >
      {task.title}
    </div>
  );
};

const Column: React.FC<{
  columnId: ColumnId;
  title: string;
  tasks: Task[];
  onAdd: (columnId: ColumnId, title: string) => void;
}> = ({ columnId, title, tasks, onAdd }) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: columnId, data: { type: 'column', columnId } });
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(columnId, v);
    setValue('');
    setAdding(false);
  };

  return (
    <div className='flex w-300px min-w-260px flex-col rounded-12px border border-solid border-[var(--color-border-2)] bg-fill-1'>
      <div className='flex items-center justify-between px-12px py-10px'>
        <span className='text-13px font-600 text-t-primary'>{title}</span>
        <span className='flex size-20px items-center justify-center rounded-100px bg-brand-light text-11px text-t-secondary'>
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        data-testid={`column-${columnId}`}
        className='flex-1 min-h-60px flex flex-col gap-8px px-10px pb-10px transition-colors'
        style={isOver ? { background: 'var(--brand-light)' } : undefined}
      >
        <SortableContext items={tasks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className='py-12px text-center text-12px text-t-tertiary'>{t('common.tasks.empty')}</div>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </SortableContext>
        {adding ? (
          <div className='flex flex-col gap-6px'>
            <Input.TextArea
              autoFocus
              autoSize={{ minRows: 1, maxRows: 4 }}
              value={value}
              onChange={setValue}
              placeholder={t('common.tasks.cardPlaceholder')}
              onPressEnter={(e) => {
                e.preventDefault();
                submit();
              }}
            />
            <div className='flex gap-6px'>
              <Button size='mini' type='primary' onClick={submit}>
                {t('common.tasks.add')}
              </Button>
              <Button
                size='mini'
                onClick={() => {
                  setAdding(false);
                  setValue('');
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type='button'
            data-testid={`add-card-${columnId}`}
            className='flex items-center gap-6px rounded-8px bg-transparent border-0 px-6px py-6px text-12px text-t-secondary hover:bg-fill-2 cursor-pointer transition-colors'
            onClick={() => setAdding(true)}
          >
            <Plus theme='outline' size='13' fill='currentColor' />
            {t('common.tasks.addCard')}
          </button>
        )}
      </div>
    </div>
  );
};

const TasksPage: React.FC = () => {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Board>(INITIAL_BOARD);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columnTitles: Record<ColumnId, string> = useMemo(
    () => ({ todo: t('common.tasks.colTodo'), doing: t('common.tasks.colDoing'), done: t('common.tasks.colDone') }),
    [t]
  );

  const findColumn = (id: string): ColumnId | undefined => {
    if (COLUMN_ORDER.includes(id as ColumnId)) return id as ColumnId;
    return COLUMN_ORDER.find((col) => board[col].some((task) => task.id === id));
  };

  const handleAdd = (columnId: ColumnId, title: string) => {
    setBoard((prev) => ({ ...prev, [columnId]: [...prev[columnId], { id: `t${++cardSeq}`, title }] }));
  };

  const handleDragStart = (e: DragStartEvent) => {
    const col = findColumn(String(e.active.id));
    if (col) setActiveTask(board[col].find((t2) => t2.id === e.active.id) || null);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;
    setBoard((prev) => {
      const moving = prev[from].find((x) => x.id === active.id);
      if (!moving) return prev;
      const overIndex = prev[to].findIndex((x) => x.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : prev[to].length;
      return {
        ...prev,
        [from]: prev[from].filter((x) => x.id !== active.id),
        [to]: [...prev[to].slice(0, insertAt), moving, ...prev[to].slice(insertAt)],
      };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;
    const col = findColumn(String(active.id));
    const overCol = findColumn(String(over.id));
    if (!col || col !== overCol) return;
    if (active.id === over.id) return;
    setBoard((prev) => {
      const oldIndex = prev[col].findIndex((x) => x.id === active.id);
      const newIndex = prev[col].findIndex((x) => x.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return { ...prev, [col]: arrayMove(prev[col], oldIndex, newIndex) };
    });
  };

  return (
    <div className='flex h-full w-full min-h-0 flex-col bg-base'>
      <div className='flex items-center gap-10px border-b border-solid border-border-2 bg-fill-1 px-16px py-12px'>
        <span className='flex size-32px items-center justify-center rounded-10px bg-base border border-solid border-[var(--color-border-2)] shrink-0'>
          <img src={alineaMark} alt='' className='size-18px' />
        </span>
        <div className='min-w-0'>
          <div className='text-15px font-600 text-t-primary leading-20px'>{t('common.tasks.title')}</div>
          <div className='text-12px text-t-tertiary leading-16px'>{t('common.tasks.subtitle')}</div>
        </div>
      </div>

      <div className='flex-1 min-h-0 overflow-auto p-16px'>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className='flex gap-14px items-start'>
            {COLUMN_ORDER.map((col) => (
              <Column key={col} columnId={col} title={columnTitles[col]} tasks={board[col]} onAdd={handleAdd} />
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>

      <div className='border-t border-solid border-border-2 px-16px py-8px text-11px text-t-tertiary'>
        {t('common.tasks.prototypeNotice')}
      </div>
    </div>
  );
};

export default TasksPage;
