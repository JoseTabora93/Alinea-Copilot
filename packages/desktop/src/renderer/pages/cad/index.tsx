/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AcApDocManager } from '@mlightcad/cad-simple-viewer';
import alineaMark from '@renderer/assets/logos/brand/alinea-mark.svg';
import { Button, Message } from '@arco-design/web-react';
import { FolderOpen, Components } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// The CAD engine (@mlightcad/cad-simple-viewer) is a singleton. We create it once
// and re-parent its canvas into the active container on revisit.
let cadCreated = false;
let cadCanvas: HTMLCanvasElement | null = null;

const SAMPLE_DXF_URL = 'samples/alinea_sample.dxf';

const CadViewerPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!cadCreated) {
        // notLoadDefaultFonts avoids fetching external font packs (self-host friendly);
        // geometry renders fully — text/MTEXT fonts can be wired later.
        AcApDocManager.createInstance({ container, autoResize: true, notLoadDefaultFonts: true });
        cadCreated = true;
        cadCanvas = container.querySelector('canvas');
      } else if (cadCanvas && cadCanvas.parentElement !== container) {
        container.appendChild(cadCanvas);
      }
    } catch (err) {
      console.error('[CadViewer] init failed:', err);
    }
  }, []);

  const openBuffer = useCallback(async (name: string, buffer: ArrayBuffer) => {
    setLoading(true);
    try {
      const ok = await AcApDocManager.instance.openDocument(name, buffer, { minimumChunkSize: 1000 });
      if (!ok) Message.error('No se pudo abrir el archivo CAD');
    } catch (err) {
      console.error('[CadViewer] openDocument failed:', err);
      Message.error('Error al abrir el archivo CAD');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadSample = useCallback(async () => {
    try {
      const url = new URL(SAMPLE_DXF_URL, document.baseURI).href;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      await openBuffer('alinea_sample.dxf', buf);
    } catch (err) {
      console.error('[CadViewer] load sample failed:', err);
      Message.error('No se pudo cargar el plano de muestra');
    }
  }, [openBuffer]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const buf = await file.arrayBuffer();
      await openBuffer(file.name, buf);
    },
    [openBuffer]
  );

  return (
    <div className='flex h-full w-full min-h-0 flex-col bg-base'>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center justify-between gap-12px border-b border-solid border-border-2 bg-fill-1 px-16px py-12px'>
        <div className='flex items-center gap-10px min-w-0'>
          <span className='flex size-32px items-center justify-center rounded-10px bg-base border border-solid border-[var(--color-border-2)] shrink-0'>
            <img src={alineaMark} alt='' className='size-18px' />
          </span>
          <div className='min-w-0'>
            <div className='text-15px font-600 text-t-primary leading-20px'>Visor CAD (DXF)</div>
            <div className='text-12px text-t-tertiary leading-16px'>Visualiza planos sin AutoCAD · pan/zoom</div>
          </div>
        </div>
        <div className='flex items-center gap-8px'>
          <Button
            type='secondary'
            size='small'
            icon={<Components theme='outline' size='14' />}
            loading={loading}
            onClick={handleLoadSample}
          >
            Cargar muestra
          </Button>
          <Button
            type='primary'
            size='small'
            icon={<FolderOpen theme='outline' size='14' />}
            onClick={() => fileInputRef.current?.click()}
          >
            Abrir DXF
          </Button>
          <input ref={fileInputRef} type='file' accept='.dxf,.dwg' className='hidden' onChange={handleFileChange} />
        </div>
      </div>

      {/* Viewer container */}
      <div ref={containerRef} className='relative flex-1 min-h-0 w-full' style={{ background: 'var(--bg-2)' }} />
    </div>
  );
};

export default CadViewerPage;
