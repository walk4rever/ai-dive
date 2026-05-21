'use client'

import { useEffect, useRef } from 'react'

interface MermaidContentProps {
  className?: string
  html: string
}

function extractYouTubeVideoId(href: string): string | null {
  try {
    const url = new URL(href)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0]
      return id ? id : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v')
        return id ? id : null
      }
      const match = url.pathname.match(/^\/embed\/([^/?#]+)/)
      if (match?.[1]) return match[1]
    }
  } catch {
    return null
  }

  return null
}

function createYouTubeIframe(id: string) {
  const iframe = document.createElement('iframe')
  iframe.src = `https://www.youtube.com/embed/${id}`
  iframe.title = 'YouTube'
  iframe.width = '100%'
  iframe.height = '315'
  iframe.setAttribute('frameborder', '0')
  iframe.allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
  iframe.allowFullscreen = true
  iframe.style.width = '100%'
  iframe.style.aspectRatio = '16 / 9'
  return iframe
}

function inferYouTubeIdFromElement(el: Element): string | null {
  const anchors = Array.from(el.querySelectorAll('a'))
  if (anchors.length === 1) {
    const href = anchors[0].href
    const id = extractYouTubeVideoId(href)
    if (!id) return null

    const text = (el.textContent ?? '').trim()
    const normalized = text.replace(/\s+/g, ' ')

    if (
      normalized === href ||
      normalized === anchors[0].textContent?.trim() ||
      normalized === `原视频：${href}` ||
      normalized === `原视频: ${href}` ||
      (normalized.endsWith(href) && normalized.length <= href.length + 6)
    ) {
      return id
    }
  }

  if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
    const text = (el.textContent ?? '').trim()
    if (text) return extractYouTubeVideoId(text)
  }

  return null
}

function removeYouTubeCoverImage(container: HTMLElement, id: string) {
  const images = Array.from(container.querySelectorAll('img'))
  const match = images.find((img) => {
    const src = img.getAttribute('src') ?? ''
    const alt = (img.getAttribute('alt') ?? '').trim().toLowerCase()
    return src.includes(`i.ytimg.com/vi/${id}/`) || alt === '封面' || alt === 'cover'
  })

  if (!match) return

  const parent = match.parentElement
  if (parent?.tagName === 'P' && parent.childNodes.length === 1) {
    parent.remove()
  } else {
    match.remove()
  }
}

export function MermaidContent({ className, html }: MermaidContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const renderDiagrams = async () => {
      const container = containerRef.current
      if (!container) return

      const candidates = Array.from(container.querySelectorAll('p, li'))
      for (const el of candidates) {
        const id = inferYouTubeIdFromElement(el)
        if (!id) continue

        removeYouTubeCoverImage(container, id)

        const iframe = createYouTubeIframe(id)
        el.replaceWith(iframe)

        const parent = iframe.parentElement
        if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL') && parent.children.length === 0) {
          parent.remove()
        }
      }

      const diagrams = Array.from(
        container.querySelectorAll<HTMLElement>('[data-mermaid="true"]:not([data-mermaid-processed="true"])')
      )

      if (diagrams.length === 0) return

      const mermaid = (await import('mermaid')).default
      if (cancelled) return

      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
      })

      for (const diagram of diagrams) {
        diagram.dataset.mermaidProcessed = 'true'
      }

      try {
        await mermaid.run({ nodes: diagrams })
      } catch (error) {
        console.error('[mermaid] failed to render diagram', error)
      }
    }

    void renderDiagrams()

    return () => {
      cancelled = true
    }
  }, [html])

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
