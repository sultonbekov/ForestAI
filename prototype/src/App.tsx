import { useState } from 'react'
import { useRegionData } from './hooks/useRegionData'
import type { Lang } from './i18n'
import { tr } from './i18n'
import MapView from './components/MapView'
import Chart3D from './components/Chart3D'
import RegionPanel from './components/RegionPanel'
import StatsSummary from './components/StatsSummary'

type ViewMode = 'map' | 'chart'
type Level = 'region' | 'district'

export default function App() {
  const { regions, districts, statsById, loading, error, national } = useRegionData()
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.hash.match(/sel=([a-z]+:\d+)/)
    return m ? m[1] : null
  })
  const [lang, setLang] = useState<Lang>('ru')
  const [view, setView] = useState<ViewMode>(
    typeof window !== 'undefined' && window.location.hash.includes('chart') ? 'chart' : 'map'
  )
  const [chartLevel, setChartLevel] = useState<Level>(
    typeof window !== 'undefined' && window.location.hash.includes('tuman') ? 'district' : 'region'
  )
  const [filterRegion, setFilterRegion] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const m = window.location.hash.match(/reg(\d+)/)
    return m ? Number(m[1]) : null
  })

  const selected = selectedId ? statsById[selectedId] ?? null : null
  const ready = regions && districts && !error

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="z-20 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-700 text-lg shadow-lg shadow-emerald-900/40">
            🌳
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-white">
              {tr('appTitle', lang)}
            </h1>
            <p className="text-[11px] leading-tight text-slate-400">
              {tr('appSubtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Til tanlash */}
          <div className="flex overflow-hidden rounded-lg border border-slate-700 text-xs">
            {(['uz', 'ru'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1.5 font-medium uppercase transition ${
                  lang === l ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Ko'rinish: Xarita / 3D diagramma */}
          <div className="flex overflow-hidden rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setView('map')}
              className={`px-3 py-1.5 font-medium transition ${
                view === 'map' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              🗺 {tr('viewMap', lang)}
            </button>
            <button
              onClick={() => setView('chart')}
              className={`px-3 py-1.5 font-medium transition ${
                view === 'chart'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              📊 {tr('viewChart', lang)}
            </button>
          </div>
        </div>
      </header>

      {/* National summary bar */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-5 py-3">
        <StatsSummary
          lang={lang}
          totalTrees={national.totalTrees}
          avgGreenery={national.avgGreenery}
          districts={national.districts}
        />
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map / chart area */}
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-slate-400">
              <div className="animate-pulse text-sm">Yuklanmoqda…</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-red-400">
              <div>
                <div className="mb-2 text-2xl">⚠️</div>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
          {ready && view === 'map' && (
            <>
              <MapView
                regions={regions}
                districts={districts}
                statsById={statsById}
                selectedId={selectedId}
                onSelect={setSelectedId}
                lang={lang}
              />

              {/* Legend */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-xl border border-slate-700/60 bg-slate-900/85 px-3 py-2.5 backdrop-blur">
                <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">
                  {tr('legendTitle', lang)}
                </div>
                <div
                  className="h-2.5 w-40 rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, rgb(220,38,38), rgb(234,179,8), rgb(132,204,22), rgb(21,128,61))',
                  }}
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>8% · {tr('legendLow', lang)}</span>
                  <span>28% · {tr('legendHigh', lang)}</span>
                </div>
              </div>
            </>
          )}

          {ready && view === 'chart' && (
            <>
              <Chart3D
                regions={regions}
                districts={districts}
                statsById={statsById}
                level={chartLevel}
                filterRegionId={chartLevel === 'district' ? filterRegion : null}
                selectedId={selectedId}
                onSelect={setSelectedId}
                lang={lang}
              />

              {/* Boshqaruv paneli: Viloyat/Tuman + viloyat ro'yxati */}
              <div className="absolute left-4 top-4 z-[400] flex items-center gap-2">
                <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900/85 text-xs backdrop-blur">
                  <button
                    onClick={() => {
                      setChartLevel('region')
                      setFilterRegion(null)
                    }}
                    className={`px-4 py-2 font-semibold transition ${
                      chartLevel === 'region'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {tr('levelRegion', lang)}
                  </button>
                  <button
                    onClick={() => setChartLevel('district')}
                    className={`px-4 py-2 font-semibold transition ${
                      chartLevel === 'district'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {tr('levelDistrict', lang)}
                  </button>
                </div>

                {/* Viloyat tanlash ro'yxati (faqat Tuman rejimida) */}
                {chartLevel === 'district' && (
                  <select
                    value={filterRegion ?? ''}
                    onChange={(e) =>
                      setFilterRegion(e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="rounded-lg border border-slate-700 bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur outline-none hover:bg-slate-800 focus:border-emerald-500"
                  >
                    <option value="">{tr('allRegions', lang)}</option>
                    {regions.features
                      .map((f) => {
                        const p = f.properties as {
                          name?: string
                          name_ru?: string
                        }
                        const nm = (lang === 'ru' && p.name_ru) || p.name || ''
                        return { id: Number(f.id), nm }
                      })
                      .sort((a, b) => a.nm.localeCompare(b.nm))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nm}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Hint */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur">
                {chartLevel === 'district' && filterRegion == null
                  ? `${tr('topDistricts', lang)} · `
                  : ''}
                {tr('chartHint', lang)}
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900/70">
          <RegionPanel stats={selected} lang={lang} />
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/80 px-5 py-1.5 text-center text-[11px] text-slate-500">
        {tr('footer', lang)} · {tr('legalBasis', lang)} · Isabek Sultonbekov
      </footer>
    </div>
  )
}
