import { useEffect } from 'react';

// Sets document title, meta description and robots per route (no dependency needed).
export function usePageMeta({ title, description, noindex = false }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const setMeta = (name, content) => {
      if (content == null) return null;
      let el = document.querySelector(`meta[name="${name}"]`);
      const prev = el ? el.getAttribute('content') : null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
      return () => (prev == null ? el.remove() : el.setAttribute('content', prev));
    };

    const undoDesc = setMeta('description', description);
    const undoRobots = setMeta('robots', noindex ? 'noindex, nofollow' : null);

    return () => {
      document.title = prevTitle;
      if (undoDesc) undoDesc();
      if (undoRobots) undoRobots();
    };
  }, [title, description, noindex]);
}

export default usePageMeta;
