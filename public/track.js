/**
 * Black Index Tracking Script
 * 
 * Drop-in script for founders to track referrals automatically.
 * 
 * Usage:
 * <script src="https://blackindex.in/track.js" data-product="PRODUCT_ID"></script>
 * 
 * Features:
 * - Auto-captures ref_id from URL
 * - Persists in localStorage (30 days)
 * - Auto-injects into Stripe Checkout
 * - Auto-injects into Razorpay options
 * - Exposes window.BlackIndex.getRefId() for manual use
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'bi_ref_id';
    const STORAGE_EXPIRY_KEY = 'bi_ref_expiry';
    const EXPIRY_DAYS = 30;

    // ============================================
    // CORE FUNCTIONS
    // ============================================

    /**
     * Get ref_id from URL params
     */
    function getRefFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('ref_id') || params.get('refId') || params.get('ref');
    }

    /**
     * Store ref_id in localStorage with expiry
     */
    function storeRef(refId) {
        if (!refId) return;
        
        try {
            const expiry = Date.now() + (EXPIRY_DAYS * 24 * 60 * 60 * 1000);
            localStorage.setItem(STORAGE_KEY, refId);
            localStorage.setItem(STORAGE_EXPIRY_KEY, expiry.toString());
        } catch (e) {
            // localStorage not available, use cookie fallback
            document.cookie = `bi_ref_id=${refId}; max-age=${EXPIRY_DAYS * 24 * 60 * 60}; path=/; SameSite=Lax`;
        }
    }

    /**
     * Get stored ref_id (checks expiry)
     */
    function getStoredRef() {
        try {
            const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
            if (expiry && Date.now() > parseInt(expiry)) {
                // Expired - clear
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(STORAGE_EXPIRY_KEY);
                return null;
            }
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            // Fallback to cookie
            const match = document.cookie.match(/bi_ref_id=([^;]+)/);
            return match ? match[1] : null;
        }
    }

    /**
     * Get active ref_id (URL takes precedence)
     */
    function getRefId() {
        const urlRef = getRefFromUrl();
        if (urlRef) {
            storeRef(urlRef);
            return urlRef;
        }
        return getStoredRef();
    }

    // ============================================
    // STRIPE INTEGRATION
    // ============================================

    /**
     * Monkey-patch Stripe Checkout to auto-inject ref_id
     */
    function patchStripeCheckout() {
        let _stripe;
        
        function applyPatch(original) {
            const stripeFunc = function(...args) {
                const stripe = original.apply(this, args);
                const originalRedirectToCheckout = stripe.redirectToCheckout;

                stripe.redirectToCheckout = function(options) {
                    const refId = getRefId();
                    if (refId && options) {
                        if (options.lineItems) {
                            options.clientReferenceId = options.clientReferenceId || refId;
                        }
                        console.log('[BlackIndex] Injected ref_id into Stripe:', refId);
                    }
                    return originalRedirectToCheckout.call(this, options);
                };
                return stripe;
            };
            return stripeFunc;
        }

        if (typeof window.Stripe !== 'undefined' && !window.Stripe.__patched) {
            window.Stripe = applyPatch(window.Stripe);
            window.Stripe.__patched = true;
        }

        try {
            Object.defineProperty(window, 'Stripe', {
                get: function() { return _stripe; },
                set: function(val) {
                    if (val && !val.__patched) {
                        _stripe = applyPatch(val);
                        _stripe.__patched = true;
                    } else {
                        _stripe = val;
                    }
                },
                configurable: true
            });
        } catch(e) {}
    }

    // ============================================
    // RAZORPAY INTEGRATION
    // ============================================

    /**
     * Monkey-patch Razorpay to auto-inject ref_id
     */
    function patchRazorpay() {
        let _razorpay;

        function applyPatch(OriginalRazorpay) {
            const patched = function(options) {
                const refId = getRefId();
                if (refId && options) {
                    options.notes = options.notes || {};
                    options.notes.ref_id = refId;
                    console.log('[BlackIndex] Injected ref_id into Razorpay:', refId);
                }
                return new OriginalRazorpay(options);
            };
            Object.keys(OriginalRazorpay).forEach(key => {
                patched[key] = OriginalRazorpay[key];
            });
            return patched;
        }

        if (typeof window.Razorpay !== 'undefined' && !window.Razorpay.__patched) {
            window.Razorpay = applyPatch(window.Razorpay);
            window.Razorpay.__patched = true;
        }

        try {
            Object.defineProperty(window, 'Razorpay', {
                get: function() { return _razorpay; },
                set: function(val) {
                    if (val && !val.__patched) {
                        _razorpay = applyPatch(val);
                        _razorpay.__patched = true;
                    } else {
                        _razorpay = val;
                    }
                },
                configurable: true
            });
        } catch (e) {}
    }

    // ============================================
    // FORM INTEGRATION
    // ============================================

    /**
     * Auto-inject hidden ref_id field into forms
     */
    function patchForms() {
        document.querySelectorAll('form').forEach(form => {
            // Skip if already has ref_id field
            if (form.querySelector('input[name="ref_id"]')) return;

            const refId = getRefId();
            if (refId) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'ref_id';
                input.value = refId;
                form.appendChild(input);
            }
        });
    }

    // ============================================
    // GUMROAD INTEGRATION
    // ============================================

    /**
     * Append ref_id to Gumroad links
     */
    function patchGumroadLinks() {
        const refId = getRefId();
        if (!refId) return;

        document.querySelectorAll('a[href*="gumroad.com"]').forEach(link => {
            try {
                const url = new URL(link.href);
                if (!url.searchParams.has('ref_id')) {
                    url.searchParams.set('ref_id', refId);
                    link.href = url.toString();
                }
            } catch (e) {
                // Invalid URL
            }
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function getProductId() {
        try {
            var scripts = document.querySelectorAll('script[data-product]');
            for (var i = 0; i < scripts.length; i++) {
                var src = scripts[i].getAttribute('src') || '';
                if (src.indexOf('track.js') !== -1) {
                    return scripts[i].getAttribute('data-product');
                }
            }
        } catch (e) {}
        return null;
    }

    function sendBeacon() {
        // One-time diagnostic ping: lets the founder know their install works
        // (dashboard install-status flips "script detected") — no PII, no PII storage.
        try {
            var pid = getProductId();
            if (!pid) return;
            var key = 'bi_beacon_' + pid;
            if (localStorage.getItem(key)) return;
            localStorage.setItem(key, '1');
            var base = window.location.protocol + '//blackindex.in';
            fetch(base + '/api/install/ping?product=' + encodeURIComponent(pid), { mode: 'cors', credentials: 'omit' }).catch(function() {});
        } catch (e) {}
    }

    function init() {
        // Capture ref from URL immediately
        const refId = getRefId();
        
        // Log for debugging
        if (refId) {
            console.log('[BlackIndex] Tracking ref_id:', refId);
        }

        sendBeacon();

        // Wait for DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }
    }

    function onReady() {
        // Patch payment providers
        patchStripeCheckout();
        patchRazorpay();
        patchForms();
        patchGumroadLinks();

        // Re-patch on dynamic content
        const observer = new MutationObserver(() => {
            patchForms();
            patchGumroadLinks();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Try again after scripts load
        setTimeout(() => {
            patchStripeCheckout();
            patchRazorpay();
        }, 2000);
    }

    // ============================================
    // PUBLIC API
    // ============================================

    window.BlackIndex = {
        /**
         * Get the current ref_id
         */
        getRefId: getRefId,

        /**
         * Manually set ref_id (for custom integrations)
         */
        setRefId: storeRef,

        /**
         * Clear stored ref_id
         */
        clearRefId: function() {
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(STORAGE_EXPIRY_KEY);
            } catch (e) {}
            document.cookie = 'bi_ref_id=; max-age=0; path=/';
        },

        /**
         * Get tracking data for manual webhook calls
         */
        getTrackingData: function() {
            return {
                ref_id: getRefId(),
                timestamp: Date.now(),
                url: window.location.href,
            };
        },

        /**
         * Version
         */
        version: '1.0.0'
    };

    // Start
    init();

})();
