import { readFileSync } from 'node:fs'
import path from 'node:path'

const FRONTEND_ROOT = path.resolve(__dirname, '..')

describe('ad admin isolation', () => {
  it('mounts AdProvider only on the public site layout', () => {
    const siteLayout = readFileSync(
      path.join(FRONTEND_ROOT, 'app', '[locale]', '(site)', 'layout.tsx'),
      'utf8',
    )
    const adminLayout = readFileSync(
      path.join(FRONTEND_ROOT, 'app', '(admin)', 'admin', 'layout.tsx'),
      'utf8',
    )

    expect(siteLayout).toContain('AdProvider')
    expect(adminLayout).not.toContain('AdProvider')
  })

  it('disables the masthead ad ribbon in admin', () => {
    const adminLayout = readFileSync(
      path.join(FRONTEND_ROOT, 'app', '(admin)', 'admin', 'layout.tsx'),
      'utf8',
    )

    expect(adminLayout).toContain('showAdRibbon={false}')
  })

  it('does not load Google Publisher Tag scripts anywhere in the frontend', () => {
    const packageJson = readFileSync(path.join(FRONTEND_ROOT, 'package.json'), 'utf8')
    expect(packageJson).not.toMatch(/googletag|gpt\.js|securepubads/i)
  })
})
