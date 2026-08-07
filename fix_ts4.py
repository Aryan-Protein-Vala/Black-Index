def replace_in_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)

replace_in_file('app/api/meetings/confirm/[txId]/route.ts', [
    ('tx.status !==', 't.status !==')
])

replace_in_file('app/api/webhooks/calcom/[productId]/route.ts', [
    ("refundExternalId: uid,\n                amount: 0", "refundExternalId: uid,\n                externalTransactionIdCandidates: [uid],\n                provider: 'calcom',\n                amount: 0")
])

replace_in_file('app/api/webhooks/shopify/[productId]/route.ts', [
    ("refundExternalId: orderId,\n                amount: 0", "refundExternalId: orderId,\n                externalTransactionIdCandidates: [orderId],\n                provider: 'shopify',\n                amount: 0")
])

