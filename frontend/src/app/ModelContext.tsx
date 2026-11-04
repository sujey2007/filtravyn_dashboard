import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadModelConfig } from '../services/api'
import type { Mapping } from '../features/digital-twin/Twin'

// Holds the replaceable 3D model: configured asset (public/models/model.config.json) or a GLB picked in the browser.

interface Ctx {
  modelUrl: string | null
  source: 'none' | 'config' | 'upload'
  fileName: string | null
  mapping: Mapping
  pipeRoute: string[] | null
  meshNames: string[]
  error: string | null
  useUpload: (file: File) => void
  clear: () => void
  setMapping: (m: Mapping) => void
  setMeshNames: (n: string[]) => void
  setError: (e: string | null) => void
}

const ModelCtx = createContext<Ctx | null>(null)

export function useModel(): Ctx {
  const c = useContext(ModelCtx)
  if (!c) throw new Error('useModel must be used inside <ModelProvider>')
  return c
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const [configUrl, setConfigUrl] = useState<string | null>(null)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Mapping>({})
  const [pipeRoute, setPipeRoute] = useState<string[] | null>(null)
  const [meshNames, setMeshNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadModelConfig().then((c) => {
      setConfigUrl(c.asset)
      setMapping(c.mapping as Mapping)
      setPipeRoute(c.pipeRoute)
      if (c.asset) setFileName(c.asset.split('/').pop() ?? c.asset)
    })
  }, [])

  const useUpload = useCallback((file: File) => {
    setError(null)
    setUploadUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
    setFileName(file.name)
  }, [])

  const clear = useCallback(() => {
    setUploadUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    setConfigUrl(null)
    setFileName(null)
    setMeshNames([])
    setError(null)
  }, [])

  const modelUrl = uploadUrl ?? configUrl
  const value: Ctx = {
    modelUrl,
    source: uploadUrl ? 'upload' : configUrl ? 'config' : 'none',
    fileName,
    mapping,
    pipeRoute,
    meshNames,
    error,
    useUpload,
    clear,
    setMapping,
    setMeshNames,
    setError,
  }
  return <ModelCtx.Provider value={value}>{children}</ModelCtx.Provider>
}
