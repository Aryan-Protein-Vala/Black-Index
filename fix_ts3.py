def replace_in_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)

replace_in_file('app/api/cron/dispute-guillotine/route.ts', [
    ('profile?.username', '(profile as any)?.username'),
    ('profile?.full_name', '(profile as any)?.full_name'),
    ('profile?.email', '(profile as any)?.email')
])

replace_in_file('app/api/meetings/confirm/[txId]/route.ts', [
    ('!tx ||', '!t ||')
])

replace_in_file('app/api/webhooks/calcom/[productId]/route.ts', [
    ("amount: 0, // processRefund infers it from tx\n                currency: 'INR'", "amount: 0 // processRefund infers it from tx")
])

replace_in_file('app/api/webhooks/shopify/[productId]/route.ts', [
    ("amount: 0,\n                currency: 'INR'", "amount: 0")
])

