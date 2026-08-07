def replace_in_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)

replace_in_file('app/api/cron/dispute-guillotine/route.ts', [
    ('for (const seller of stats) {', 'for (const seller of stats as any[]) {')
])

replace_in_file('app/api/disputes/[txId]/evidence/route.ts', [
    ('if (!tx) return', 'const t = tx as any;\n        if (!t) return'),
    ('if (tx.founder_id !== user.id && tx.seller_id !== user.id)', 'if (t.founder_id !== user.id && t.seller_id !== user.id)'),
    ('user.id === tx.founder_id ? tx.seller_id : tx.founder_id', 'user.id === t.founder_id ? t.seller_id : t.founder_id'),
    ('tx.products as any', 't.products')
])

replace_in_file('app/api/meetings/confirm/[txId]/route.ts', [
    ('if (!tx || tx.status !==', 'const t = tx as any;\n    if (!t || t.status !=='),
    ('t.confirmed_by_buyer', 't.confirmed_by_buyer'),
    ('tx.seller_id', 't.seller_id'),
    ('tx.commission_amount', 't.commission_amount')
])

replace_in_file('app/api/webhooks/calcom/[productId]/route.ts', [
    ('if (!product || !product.webhook_secret)', 'const p = product as any;\n        if (!p || !p.webhook_secret)'),
    ('product.webhook_secret', 'p.webhook_secret'),
    ('product.founder_id', 'p.founder_id'),
    ('saleExternalId: uid,', '')
])

replace_in_file('app/api/webhooks/shopify/[productId]/route.ts', [
    ('if (!product || !product.shopify_hmac_secret)', 'const p = product as any;\n        if (!p || !p.shopify_hmac_secret)'),
    ('product.shopify_hmac_secret', 'p.shopify_hmac_secret'),
    ('product.founder_id', 'p.founder_id'),
    ('saleExternalId: orderId,', '')
])

