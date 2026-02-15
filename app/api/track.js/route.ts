import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * GET /api/track.js
 * Serves the tracking script with proper caching and CORS headers
 */
export async function GET(request: NextRequest) {
    try {
        // Read the tracking script
        const scriptPath = path.join(process.cwd(), 'public', 'track.js')
        const script = await fs.readFile(scriptPath, 'utf-8')

        // Return with proper headers
        return new NextResponse(script, {
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'X-Content-Type-Options': 'nosniff',
            }
        })
    } catch (error) {
        console.error('Failed to serve track.js:', error)
        return new NextResponse('// Error loading tracking script', {
            status: 500,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
            }
        })
    }
}
