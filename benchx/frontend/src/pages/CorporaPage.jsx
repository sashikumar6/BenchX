import { useCallback, useEffect, useState } from 'react'
import CorpusUpload from '../components/CorpusUpload'
import CorporaTable from '../components/CorporaTable'
import PageHeader from '../components/PageHeader'
import { addDocument, createCorpus, deleteCorpus, listCorpora } from '../api'
import { useToast } from '../hooks/useToast'

export default function CorporaPage() {
  const [corpora, setCorpora] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()

  const refresh = useCallback(async () => {
    try {
      setCorpora(await listCorpora())
    } catch (err) {
      toast.error(`Failed to load knowledge bases: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleUpload = async ({ name, description, documents }) => {
    setUploading(true)
    try {
      const corpus = await createCorpus({ name, description })
      for (const doc of documents) {
        await addDocument(corpus.id, doc)
      }
      toast.success('Knowledge base uploaded')
      await refresh()
      return true
    } catch (err) {
      toast.error(`Failed to upload knowledge base: ${err.message}`)
      return false
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteCorpus(id)
      toast.success('Knowledge base deleted')
      await refresh()
    } catch (err) {
      toast.error(`Failed to delete knowledge base: ${err.message}`)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="03 — RETRIEVAL"
        title="Knowledge Base"
        description="Upload reference documents once, then attach them to any experiment to enable retrieval-augmented (RAG) answers — the model gets relevant passages from these docs instead of relying on training knowledge alone."
      />
      {loading ? (
        <div className="text-text-secondary text-sm">Loading knowledge bases…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          <div className="lg:col-span-3">
            <CorpusUpload onUpload={handleUpload} loading={uploading} />
          </div>
          <div className="lg:col-span-7">
            <CorporaTable corpora={corpora} onDelete={handleDelete} />
          </div>
        </div>
      )}
    </div>
  )
}
