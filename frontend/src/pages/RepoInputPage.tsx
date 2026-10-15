import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepoContext } from '../context/RepoContext'
import { ingestRepositoryAsync } from '../services/api'

export function RepoInputPage() {
  const navigate = useNavigate()
  const { repoId, status, setStatus } = useRepoContext()
  const [repoUrl, setRepoUrl] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [sourceType, setSourceType] = useState<'github' | 'zip'>('github')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [shake, setShake] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [navTooltip, setNavTooltip] = useState<{ key: string; msg: string } | null>(null)

  const validateGithubUrl = (url: string): boolean => {
    const githubPattern = /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/
    return githubPattern.test(url)
  }

  const validateInput = (): boolean => {
    if (sourceType === 'github' && !repoUrl.trim()) {
      setError('Please provide a GitHub URL or upload a ZIP file')
      return false
    }
    if (sourceType === 'github' && !validateGithubUrl(repoUrl)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)')
      return false
    }
    if (sourceType === 'zip' && !zipFile) {
      setError('Please provide a GitHub URL or upload a ZIP file')
      return false
    }
    return true
  }

  const handleAnalyze = async () => {
    setError(null)
    if (!validateInput()) {
      return
    }

    setStatus('uploading')

    try {

      let result
      if (sourceType === 'github') {
        result = await ingestRepositoryAsync({ source_type: 'github', source: repoUrl })
      } else {
        result = await ingestRepositoryAsync({ source_type: 'zip', source: '', file: zipFile! })
      }
      
      // Navigate to ingestion status page with job_id
      const jobId = result.data.job_id
      navigate(`/ingestion/${jobId}`)
    } catch (err: any) {
      console.error('[handleAnalyze] error:', err)
      setStatus('error')

      let errorMessage = 'Failed to start repository ingestion'
      if (err.response?.data?.error) errorMessage = err.response.data.error
      else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))
        errorMessage = 'Request timed out. Please try again.'
      else if (err.code === 'ERR_NETWORK' || err.response?.status === 504)
        errorMessage = 'Network error. Please check your connection.'
      else if (err.message) errorMessage = err.message

      setError(errorMessage)
      
        setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  const handleGithubUrlChange = (url: string) => {
    setRepoUrl(url)
    setSourceType('github')
    setZipFile(null)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.zip')) {
      setZipFile(file)
      setSourceType('zip')
      setRepoUrl('')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setZipFile(file)
      setSourceType('zip')
      setRepoUrl('')
    }
  }

  const handleNavClick = (key: string) => {
    if (!repoId) {
      setNavTooltip({ key, msg: 'Upload a GitHub repository first' })
      setTimeout(() => setNavTooltip(null), 2500)
    } else if (status === 'processing' || status === 'uploading') {
      setNavTooltip({ key, msg: 'Repository is still processing. Please wait.' })
      setTimeout(() => setNavTooltip(null), 2500)
    } else if (status === 'ready' && repoId) {
      const paths: Record<string, string> = {
        dashboard: `/repo/${repoId}`,
        architecture: `/repo/${repoId}/architecture`,
        chat: `/repo/${repoId}/chat`,
      }
      navigate(paths[key])
    }
  }

  const isProcessing = status === 'uploading' || status === 'processing'
  const isError = status === 'error'
  const navLocked = !repoId || isProcessing

  const samples = [
    { label: 'HARSH160804/testrepo', url: 'https://github.com/HARSH160804/testrepo' },
    { label: 'HARSH160804/Discover-Dollar-Assignment', url: 'https://github.com/HARSH160804/Discover-Dollar-Assignment' },
  ]

  const capabilities = [
    {
      n: '01',
      title: 'Architecture map',
      desc: 'Layers, entry points and how the pieces call each other, drawn from the code itself rather than the README.',
    },
    {
      n: '02',
      title: 'File-by-file explanations',
      desc: 'Open any file and get its purpose, key functions, dependencies and the risks worth a second look.',
    },
    {
      n: '03',
      title: 'Chat that cites its sources',
      desc: 'Ask how auth works or where a request ends up. Answers point to the files and lines they came from.',
    },
    {
      n: '04',
      title: 'Generated documentation',
      desc: 'A README, onboarding guide and API notes you can export as Markdown or PDF.',
    },
  ]

  return (
    <div className="min-h-screen bg-ink text-gray-100">
      {/* Top bar */}
      <header className="border-b rule">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-6 w-6 rounded object-contain" />
            <span className="font-display text-[22px] leading-none text-bone">CodeLens</span>
          </div>

          <nav className="flex items-center gap-1" aria-label="Primary">
            {[
              { key: 'dashboard', label: 'Dashboard' },
              { key: 'architecture', label: 'Architecture' },
              { key: 'chat', label: 'Chat' },
            ].map((item) => (
              <div key={item.key} className="relative hidden sm:block">
                <button
                  onClick={() => handleNavClick(item.key)}
                  aria-disabled={navLocked}
                  className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                    navLocked
                      ? 'cursor-not-allowed text-gray-600'
                      : 'text-gray-300 hover:bg-white/5 hover:text-bone'
                  }`}
                >
                  {item.label}
                </button>
                {navTooltip?.key === item.key && (
                  <div
                    role="status"
                    className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded border rule bg-raised px-3 py-2 text-xs text-gray-200 animate-fade-in"
                  >
                    {navTooltip.msg}
                  </div>
                )}
              </div>
            ))}
            <a
              href="https://github.com/HARSH160804/CodeLens.AI"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 rounded px-3 py-1.5 font-mono text-xs text-gray-300 transition-colors hover:bg-white/5 hover:text-bone"
            >
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="grid gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
          <div className="animate-rise-in">
            <p className="label mb-6">Codebase intelligence</p>
            <h1 className="font-display text-[44px] leading-[1.02] text-bone sm:text-6xl lg:text-[72px]">
              Read an unfamiliar codebase{' '}
              <em className="text-accent">in minutes,</em> not days.
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-gray-300">
              Give CodeLens a GitHub repository or a ZIP. It maps the architecture, explains
              each file, and answers questions with references to the code.
            </p>

            {/* Intake */}
            <div className="mt-10 max-w-xl">
              <label htmlFor="repo-url" className="label mb-2 block">
                GitHub repository
              </label>
              <input
                id="repo-url"
                value={repoUrl}
                onChange={(e) => handleGithubUrlChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleAnalyze()}
                placeholder="https://github.com/owner/repository"
                disabled={isProcessing}
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded border rule bg-surface px-4 py-3 font-mono text-[13px] text-bone placeholder-gray-500 outline-none transition-colors focus:border-accent disabled:opacity-50"
              />

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>Try</span>
                {samples.map((sample) => (
                  <button
                    key={sample.url}
                    onClick={() => handleGithubUrlChange(sample.url)}
                    disabled={isProcessing}
                    className="font-mono text-gray-300 underline decoration-gray-600 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent disabled:opacity-50"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-line" />
                <span className="label">or</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded border border-dashed px-4 py-4 transition-colors ${
                  dragging ? 'border-accent bg-accent/5' : 'border-gray-600 hover:border-gray-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="min-w-0">
                  <div className="truncate font-mono text-[13px] text-bone">
                    {zipFile ? zipFile.name : 'Drop a .zip here'}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {zipFile ? `${(zipFile.size / 1024 / 1024).toFixed(1)} MB, ready to analyze` : 'or click to choose a file'}
                  </div>
                </div>
                <span className="label shrink-0">{zipFile ? 'Change' : 'Browse'}</span>
              </div>

              {error && (
                <p role="alert" className="mt-4 text-sm text-red-400 animate-fade-in">
                  {error}
                </p>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isProcessing}
                className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded text-sm font-medium transition-colors disabled:cursor-wait ${
                  isError ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-accent text-ink hover:bg-blue-400'
                } ${shake ? 'animate-shake' : ''}`}
              >
                {isProcessing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Starting analysis
                  </>
                ) : isError ? (
                  'Try again'
                ) : (
                  'Analyze repository'
                )}
              </button>
            </div>
          </div>

          {/* Sample output: shows what you get, in the product's own voice */}
          <aside className="animate-rise-in lg:pt-10" style={{ animationDelay: '120ms' }} aria-label="Example output">
            <div className="rounded border rule bg-surface">
              <div className="flex items-center justify-between border-b rule px-4 py-2.5">
                <span className="font-mono text-xs text-gray-300">handlers/process_repo_worker.py</span>
                <span className="label">Explained</span>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <p className="label mb-1.5">Purpose</p>
                  <p className="text-[15px] leading-relaxed text-gray-200">
                    SQS-triggered worker that downloads a repository, processes it with per-step progress
                    tracking and stores the results, so the UI can poll for status.
                  </p>
                </div>
                <div>
                  <p className="label mb-2">Key functions</p>
                  <ul className="divide-y divide-line border-y rule font-mono text-[13px]">
                    {[
                      ['lambda_handler', 'L67'],
                      ['detect_stale_jobs', 'L186'],
                      ['process_repository', 'L245'],
                    ].map(([fn, line]) => (
                      <li key={fn} className="flex items-center justify-between py-2">
                        <span className="text-bone">{fn}()</span>
                        <span className="text-gray-500">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="label mb-1.5">Worth a second look</p>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Memory is checked while processing large repositories, and a failed job is cleaned up
                    before it is reported, so half-ingested data is not left behind.
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">Illustrative output. Your repository gets its own.</p>
          </aside>
        </section>

        {/* Capabilities */}
        <section className="border-t rule py-14">
          <h2 className="font-display text-3xl text-bone">What you get</h2>
          <dl className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {capabilities.map((item) => (
              <div key={item.n} className="flex gap-5 border-t rule pt-5">
                <dt className="font-mono text-xs text-accent">{item.n}</dt>
                <dd>
                  <p className="text-[15px] font-medium text-bone">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{item.desc}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5 font-mono text-xs text-gray-500">
          <span>Lambda · API Gateway · DynamoDB · SQS · Bedrock</span>
          <span>Serverless on AWS</span>
        </div>
      </footer>
    </div>
  )
}
