import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { About } from './pages/About'
import { Browse } from './pages/Browse'
import { Home } from './pages/Home'
import { OrgDetail } from './pages/OrgDetail'

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 transition ${
    isActive ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'
  }`

function NotFound() {
  return (
    <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you are looking for does not exist.</p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700"
      >
        Back to home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-sm text-white"
            >
              CC
            </span>
            CharityCheck
          </Link>
          <nav aria-label="Main navigation">
            <ul className="flex gap-1 text-sm font-medium">
              <li>
                <NavLink to="/" end className={NAV_LINK_CLASS}>
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/browse" className={NAV_LINK_CLASS}>
                  Browse
                </NavLink>
              </li>
              <li>
                <NavLink to="/about" className={NAV_LINK_CLASS}>
                  About
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/org/:ein" element={<OrgDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-slate-500">
          <p>
            Informational only — verify at{' '}
            <a
              href="https://apps.irs.gov/app/eos/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-emerald-700 hover:underline"
            >
              apps.irs.gov
            </a>{' '}
            before donating.
          </p>
          <p className="mt-1">
            Data: IRS Form 990 via{' '}
            <a
              href="https://projects.propublica.org/nonprofits/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-emerald-700 hover:underline"
            >
              ProPublica Nonprofit Explorer
            </a>
            . Read more on the <Link to="/about" className="font-medium text-emerald-700 hover:underline">About page</Link>.
          </p>
        </div>
      </footer>
    </div>
  )
}
