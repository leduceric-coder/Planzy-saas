import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { FileText, Image, FolderOpen } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()

  const [{ data: documents }, { data: photos }] = await Promise.all([
    supabase.from('documents').select('*, project:projects(name,color), uploader:profiles!uploaded_by(full_name)')
      .eq('org_id', profile?.org_id).order('created_at', { ascending: false }),
    supabase.from('photos').select('*, project:projects(name)')
      .eq('org_id', profile?.org_id).order('taken_at', { ascending: false }).limit(40),
  ])

  const categories = [...new Set(documents?.map(d => d.category ?? 'Autre').filter(Boolean))]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Documents & Photos" subtitle={`${documents?.length ?? 0} documents · ${photos?.length ?? 0} photos`} />

      <div className="flex-1 overflow-y-auto px-10 pb-10 flex flex-col gap-8">
        {/* Documents by category */}
        <section>
          <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">Documents</h2>
          {categories.length > 0 ? (
            <div className="flex flex-col gap-6">
              {categories.map(cat => {
                const catDocs = documents?.filter(d => (d.category ?? 'Autre') === cat) ?? []
                return (
                  <div key={cat}>
                    <h3 className="text-sm font-600 text-muted-foreground mb-3 flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      {cat} ({catDocs.length})
                    </h3>
                    <div className="flex flex-col gap-2">
                      {catDocs.map((doc: any) => (
                        <a
                          key={doc.id}
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-elevated hover:border-border/60 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-600 text-foreground truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.project?.name} · {formatDate(doc.created_at)}
                              {doc.uploader && ` · ${doc.uploader.full_name}`}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Aucun document
            </div>
          )}
        </section>

        {/* Photos gallery */}
        <section>
          <h2 className="text-xs font-700 uppercase tracking-wider text-muted-foreground mb-4">
            Photos récentes ({photos?.length ?? 0})
          </h2>
          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-6 gap-3">
              {photos.map((photo: any) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-xl overflow-hidden bg-elevated border border-border relative group cursor-pointer"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? ''}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  {photo.theme && (
                    <div className="absolute top-1.5 left-1.5 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                      {photo.theme}
                    </div>
                  )}
                  {photo.project && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {photo.project.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Aucune photo
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
