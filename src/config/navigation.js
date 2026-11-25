// Site-wide navigation (CC-12). DEV-199: "About Sard" groups About, the Team page and FAQ in one
// dropdown (drawer: expandable group); Contact stays a top-level item. The Team page is now public
// (manager's decision 2026-11-25, replaces C-G03).
export const SITE_NAV = [
  { to: '/', labelKey: 'nav.home' },
  {
    id: 'about-group',
    labelKey: 'nav.aboutGroup',
    children: [
      { to: '/about', labelKey: 'nav.about' },
      { to: '/team', labelKey: 'nav.team' },
      { to: '/faq', labelKey: 'nav.faq' },
    ],
  },
  { to: '/projects', labelKey: 'nav.projects' },
  { to: '/careers', labelKey: 'nav.careers' },
  { to: '/collaborations', labelKey: 'nav.collaborations' },
  { to: '/contact', labelKey: 'nav.contact' },
  { to: '/calendar', labelKey: 'nav.calendar', drawerOnly: true },
  { to: '/ai', labelKey: 'nav.ai', drawerOnly: true },
];
