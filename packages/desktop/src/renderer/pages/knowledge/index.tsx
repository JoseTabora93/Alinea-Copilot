/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import MarkdownView from '@renderer/components/Markdown';
import { Input } from '@arco-design/web-react';
import { Down, Right, Search } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSampleBrain, type BrainNode } from './sampleBrain';

/** Flatten only the pages (for search). */
function collectPages(nodes: BrainNode[], acc: BrainNode[] = []): BrainNode[] {
  for (const node of nodes) {
    if (node.type === 'page') acc.push(node);
    if (node.children) collectPages(node.children, acc);
  }
  return acc;
}

type TreeProps = {
  nodes: BrainNode[];
  depth: number;
  selectedId?: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: BrainNode) => void;
};

const BrainTree: React.FC<TreeProps> = ({ nodes, depth, selectedId, expanded, onToggle, onSelect }) => {
  return (
    <>
      {nodes.map((node) => {
        const isOpen = expanded.has(node.id);
        const isSelected = node.id === selectedId;
        const indent = 8 + depth * 14;
        if (node.type === 'folder') {
          return (
            <div key={node.id}>
              <button
                type='button'
                data-testid={`kb-folder-${node.id}`}
                className='w-full flex items-center gap-6px py-6px pr-8px rd-6px bg-transparent border-0 cursor-pointer text-t-secondary hover:bg-fill-2 transition-colors text-13px'
                style={{ paddingLeft: indent }}
                onClick={() => onToggle(node.id)}
              >
                {isOpen ? (
                  <Down theme='outline' size='13' fill='currentColor' />
                ) : (
                  <Right theme='outline' size='13' fill='currentColor' />
                )}
                <span className='font-500 truncate'>{node.name}</span>
              </button>
              {isOpen && node.children && (
                <BrainTree
                  nodes={node.children}
                  depth={depth + 1}
                  selectedId={selectedId}
                  expanded={expanded}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              )}
            </div>
          );
        }
        return (
          <button
            key={node.id}
            type='button'
            data-testid={`kb-page-${node.id}`}
            className={`w-full flex items-center gap-6px py-6px pr-8px rd-6px border-0 cursor-pointer transition-colors text-13px ${isSelected ? 'bg-fill-3 text-t-primary font-500' : 'bg-transparent text-t-secondary hover:bg-fill-2'}`}
            style={{ paddingLeft: indent + 19 }}
            onClick={() => onSelect(node)}
          >
            <span className='truncate'>{node.name}</span>
          </button>
        );
      })}
    </>
  );
};

const KnowledgePage: React.FC = () => {
  const { t } = useTranslation();
  const brain = useMemo(() => getSampleBrain(), []);
  const allPages = useMemo(() => collectPages(brain), [brain]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(brain.filter((n) => n.type === 'folder').map((n) => n.id))
  );
  const [selected, setSelected] = useState<BrainNode | undefined>(() => allPages[0]);
  const [query, setQuery] = useState('');

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allPages.filter((p) => p.name.toLowerCase().includes(q));
  }, [query, allPages]);

  return (
    <div className='flex h-full w-full min-h-0 bg-base'>
      {/* Left: tree */}
      <aside className='flex flex-col w-280px min-w-220px max-w-320px h-full border-r border-solid border-border-2 bg-fill-1'>
        <div className='px-14px pt-16px pb-8px'>
          <div className='text-15px font-600 text-t-primary'>{t('common.knowledge.title')}</div>
          <div className='text-12px text-t-tertiary mt-2px'>{t('common.knowledge.subtitle')}</div>
        </div>
        <div className='px-12px pb-8px'>
          <Input
            allowClear
            value={query}
            onChange={setQuery}
            placeholder={t('common.knowledge.searchPlaceholder')}
            prefix={<Search theme='outline' size='14' fill='currentColor' />}
          />
        </div>
        <div className='flex-1 min-h-0 overflow-y-auto px-8px pb-16px'>
          {filteredPages ? (
            filteredPages.length > 0 ? (
              <BrainTree
                nodes={filteredPages}
                depth={0}
                selectedId={selected?.id}
                expanded={expanded}
                onToggle={toggle}
                onSelect={setSelected}
              />
            ) : (
              <div className='px-8px py-12px text-12px text-t-tertiary'>{t('common.knowledge.noResults')}</div>
            )
          ) : (
            <BrainTree
              nodes={brain}
              depth={0}
              selectedId={selected?.id}
              expanded={expanded}
              onToggle={toggle}
              onSelect={setSelected}
            />
          )}
        </div>
        <div className='px-14px py-8px border-t border-solid border-border-2 text-11px text-t-tertiary leading-snug'>
          {t('common.knowledge.prototypeNotice')}
        </div>
      </aside>

      {/* Right: reader */}
      <main className='flex-1 min-w-0 h-full overflow-y-auto'>
        {selected?.content ? (
          <div className='mx-auto max-w-760px px-32px py-28px'>
            <MarkdownView>{selected.content}</MarkdownView>
          </div>
        ) : (
          <div className='h-full flex flex-col items-center justify-center gap-6px text-center px-24px'>
            <div className='text-15px font-500 text-t-secondary'>{t('common.knowledge.empty')}</div>
            <div className='text-13px text-t-tertiary'>{t('common.knowledge.emptyHint')}</div>
          </div>
        )}
      </main>
    </div>
  );
};

export default KnowledgePage;
