import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'

const MAGIC_BYTES = {
    png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    jpeg: [0xFF, 0xD8, 0xFF],
    pdf: [0x25, 0x50, 0x44, 0x46]
}

function checkMagicBytes(buffer: Buffer): string | null {
    if (buffer.length < 8) return null
    if (MAGIC_BYTES.png.every((b, i) => buffer[i] === b)) return 'image/png'
    if (MAGIC_BYTES.jpeg.every((b, i) => buffer[i] === b)) return 'image/jpeg'
    if (MAGIC_BYTES.pdf.every((b, i) => buffer[i] === b)) return 'application/pdf'
    return null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ txId: string }> }) {
    try {
        const { txId } = await params
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const adminClient = createAdminClient()
        
        // Check if user is founder or seller of this tx
        const { data: tx } = await adminClient
            .from('transactions')
            .select('founder_id, seller_id, status, products(name)')
            .eq('id', txId)
            .single()

        const t = tx as any;
        if (!t) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
        
        if (t.founder_id !== user.id && t.seller_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const note = formData.get('note') as string

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

        const buffer = Buffer.from(await file.arrayBuffer())
        const mimeType = checkMagicBytes(buffer)
        
        if (!mimeType) {
            return NextResponse.json({ error: 'Invalid file type. Only PNG, JPEG, PDF allowed.' }, { status: 400 })
        }

        const fileName = `${txId}/${user.id}_${Date.now()}`
        
        const { error: uploadError } = await adminClient.storage
            .from('dispute-evidence')
            .upload(fileName, buffer, { contentType: mimeType })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = adminClient.storage
            .from('dispute-evidence')
            .getPublicUrl(fileName)

        await adminClient.from('dispute_evidence').insert({
            transaction_id: txId,
            uploaded_by: user.id,
            file_url: publicUrlData.publicUrl,
            note
        } as never)

        // Notify other party
        const otherPartyId = user.id === t.founder_id ? t.seller_id : t.founder_id
        await adminClient.from('notifications').insert({
            user_id: otherPartyId,
            type: 'system',
            title: 'New Dispute Evidence',
            message: `New evidence was uploaded for disputed transaction on ${(t.products)?.name}.`,
            read: false
        } as never)

        return NextResponse.json({ success: true, url: publicUrlData.publicUrl })
    } catch (error) {
        console.error('Evidence upload error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
