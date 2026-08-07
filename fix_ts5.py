with open("app/api/webhooks/calcom/[productId]/route.ts", "r") as f:
    content = f.read()

content = content.replace("amount: 0 // processRefund infers it from tx", "amount: 0,\n                externalTransactionIdCandidates: [uid],\n                provider: 'calcom'")

with open("app/api/webhooks/calcom/[productId]/route.ts", "w") as f:
    f.write(content)

with open("app/api/webhooks/shopify/[productId]/route.ts", "r") as f:
    content = f.read()

content = content.replace("amount: 0", "amount: 0,\n                externalTransactionIdCandidates: [orderId],\n                provider: 'shopify'")

with open("app/api/webhooks/shopify/[productId]/route.ts", "w") as f:
    f.write(content)

with open("app/api/meetings/confirm/[txId]/route.ts", "r") as f:
    content = f.read()

content = content.replace("if (!tx || t.status", "if (!t || t.status")

with open("app/api/meetings/confirm/[txId]/route.ts", "w") as f:
    f.write(content)

