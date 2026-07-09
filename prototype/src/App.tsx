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
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* Header */}
      <header className="z-20 flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2.5 backdrop-blur sm:px-5 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-700 text-base shadow-lg shadow-emerald-900/40 sm:h-9 sm:w-9 sm:text-lg">
            🌳
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold leading-tight text-white sm:text-base">
              {tr('appTitle', lang)}
            </h1>
            <p className="hidden truncate text-[11px] leading-tight text-slate-400 sm:block">
              {tr('appSubtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Ko'rinish: Xarita / 3D diagramma — mobil'da karta ustida ko'rsatiladi */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-700 text-xs md:flex">
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
        </div>
      </header>

      {/* National summary bar */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-3 py-2 sm:px-5 sm:py-3">
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
          {/* Mobil view-toggle (karta ustida, o'ng yuqorida) */}
          <div className="absolute right-2 top-2 z-[500] flex overflow-hidden rounded-lg border border-slate-600 bg-slate-900/90 text-xs shadow-lg backdrop-blur md:hidden">
            <button
              onClick={() => setView('map')}
              className={`px-3 py-2 font-semibold transition ${
                view === 'map' ? 'bg-emerald-600 text-white' : 'text-slate-300'
              }`}
            >
              🗺 {tr('viewMap', lang)}
            </button>
            <button
              onClick={() => setView('chart')}
              className={`px-3 py-2 font-semibold transition ${
                view === 'chart' ? 'bg-emerald-600 text-white' : 'text-slate-300'
              }`}
            >
              📊
            </button>
          </div>
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
              <div className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded-xl border border-slate-700/60 bg-slate-900/85 px-2.5 py-2 backdrop-blur sm:bottom-4 sm:left-4 sm:px-3 sm:py-2.5">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400 sm:text-[11px]">
                  {tr('legendTitle', lang)}
                </div>
                <div
                  className="h-2.5 w-28 rounded-full sm:w-40"
                  style={{
                    background:
                      'linear-gradient(90deg, rgb(220,38,38), rgb(234,179,8), rgb(132,204,22), rgb(21,128,61))',
                  }}
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>8%</span>
                  <span>28%</span>
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
              <div className="absolute left-2 top-2 z-[400] flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
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

              {/* Hint — faqat kattaroq ekranlarda */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-[400] hidden max-w-[90%] rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur sm:block">
                {chartLevel === 'district' && filterRegion == null
                  ? `${tr('topDistricts', lang)} · `
                  : ''}
                {tr('chartHint', lang)}
              </div>
            </>
          )}
        </div>

        {/* Right panel — desktopda yon panel */}
        <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900/70 md:block">
          <RegionPanel stats={selected} lang={lang} />
        </aside>
      </div>

      {/* Mobil bottom-sheet: hudud tanlanganda pastdan chiqadi */}
      {selected && (
        <div className="fixed inset-0 z-[1000] md:hidden">
          {/* orqa fon */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedId(null)}
          />
          {/* sheet */}
          <div className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 shadow-2xl animate-fade">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-2.5 backdrop-blur">
              <div className="mx-auto h-1 w-10 rounded-full bg-slate-600" />
              <button
                onClick={() => setSelectedId(null)}
                className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
                aria-label={tr('close', lang)}
              >
                ✕
              </button>
            </div>
            <RegionPanel stats={selected} lang={lang} />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/80 px-3 py-1.5 text-center text-[10px] text-slate-500 sm:px-5 sm:text-[11px]">
        <span className="hidden sm:inline">
          {tr('footer', lang)} · {tr('legalBasis', lang)} · Isabek Sultonbekov
        </span>
        <span className="sm:hidden">{tr('footer', lang)} · Isabek Sultonbekov</span>
      </footer>
    </div>
  )
}
