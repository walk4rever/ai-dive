import { describe, expect, it } from 'vitest'
import { extractHeadings } from './extract-headings'

describe('extractHeadings', () => {
  it('extracts h2, h3, and h4 headings with valid ids', () => {
    const html = `
      <h1 id="title">Ignored Title</h1>
      <h2 id="overview">Overview</h2>
      <p>Some content</p>
      <h3 id="architecture">Architecture Details</h3>
      <h4 id="pipeline">Data Pipeline</h4>
      <h5 id="deep-item">Ignored Deep Item</h5>
    `

    const headings = extractHeadings(html)
    expect(headings).toEqual([
      { id: 'overview', text: 'Overview', level: 2 },
      { id: 'architecture', text: 'Architecture Details', level: 3 },
      { id: 'pipeline', text: 'Data Pipeline', level: 4 },
    ])
  })

  it('ignores headings without id or empty text', () => {
    const html = `
      <h2>No ID</h2>
      <h2 id="">Empty ID</h2>
      <h3 id="empty-text">   </h3>
      <h2 id="valid">Valid Heading</h2>
    `

    const headings = extractHeadings(html)
    expect(headings).toEqual([
      { id: 'valid', text: 'Valid Heading', level: 2 },
    ])
  })
})
