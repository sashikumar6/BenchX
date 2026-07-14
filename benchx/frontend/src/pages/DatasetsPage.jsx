import { useCallback, useEffect, useState } from 'react'
import DatasetUpload from '../components/DatasetUpload'
import DatasetsTable from '../components/DatasetsTable'
import { createDataset, deleteDataset, listDatasets } from '../api'
import { useToast } from '../components/Toast'

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()

  const refresh = useCallback(async () => {
    try {
      setDatasets(await listDatasets())
    } catch (err) {
      toast.error(`Failed to load datasets: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleUpload = async (payload) => {
    setUploading(true)
    try {
      await createDataset(payload)
      toast.success('Dataset uploaded')
      await refresh()
      return true
    } catch (err) {
      toast.error(`Failed to upload dataset: ${err.message}`)
      return false
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDataset(id)
      toast.success('Dataset deleted')
      await refresh()
    } catch (err) {
      toast.error(`Failed to delete dataset: ${err.message}`)
    }
  }

  if (loading) {
    return <div className="text-text-secondary text-sm">Loading datasets…</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      <div className="lg:col-span-3">
        <DatasetUpload onUpload={handleUpload} loading={uploading} />
      </div>
      <div className="lg:col-span-7">
        <DatasetsTable datasets={datasets} onDelete={handleDelete} />
      </div>
    </div>
  )
}
