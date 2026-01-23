# GitHub Pages Custom Domain HTTPS Issue

## Problem
Cannot enable HTTPS for custom domain `li-astrology.com.ua` on GitHub Pages. GitHub shows error:
```
Both li-astrology.com.ua and its alternate name are improperly configured
Domain does not resolve to the GitHub Pages server. For more information, see documentation (NotServedByPagesError).
```

## Repository
- **GitHub Repo:** https://github.com/vinohradov/li-astrology
- **GitHub Pages URL:** https://vinohradov.github.io/li-astrology/
- **Custom Domain:** li-astrology.com.ua
- **Registrar:** nic.ua

## Current DNS Configuration (verified correct)

### A Records (apex domain @)
| Name | Type | Value |
|------|------|-------|
| @ | A | 185.199.108.153 |
| @ | A | 185.199.109.153 |
| @ | A | 185.199.110.153 |
| @ | A | 185.199.111.153 |

### CNAME Record (www subdomain)
| Name | Type | Value |
|------|------|-------|
| www | CNAME | vinohradov.github.io. |

### Nameservers
- ns10.uadns.com
- ns11.uadns.com
- ns12.uadns.com

## DNS Verification (all correct)

```bash
# A records - CORRECT
$ dig @8.8.8.8 li-astrology.com.ua A +short
185.199.110.153
185.199.109.153
185.199.108.153
185.199.111.153

# NS records - CORRECT
$ dig @8.8.8.8 li-astrology.com.ua NS +short
ns12.uadns.com.
ns11.uadns.com.
ns10.uadns.com.

# www CNAME - CORRECT
$ dig @8.8.8.8 www.li-astrology.com.ua CNAME +short
vinohradov.github.io.

# Direct connection to GitHub Pages - WORKS
$ curl -sI -H "Host: li-astrology.com.ua" http://185.199.108.153
HTTP/1.1 200 OK
Server: GitHub.com
Content-Length: 6511
```

## What Works
- HTTP works when bypassing DNS (via /etc/hosts or direct IP)
- Site content is correctly served by GitHub Pages
- DNS records are correctly configured and propagated globally

## What Doesn't Work
- GitHub Pages DNS check fails with "NotServedByPagesError"
- HTTPS certificate not issued (still shows *.github.io wildcard cert)
- GitHub refuses to enable "Enforce HTTPS" option

## SSL Certificate Status
```bash
$ curl -vI --resolve li-astrology.com.ua:443:185.199.108.153 https://li-astrology.com.ua 2>&1 | grep -E "(subject|SSL)"
* SSL connection using TLSv1.3
*  subject: CN=*.github.io
*  subjectAltName does not match host name li-astrology.com.ua
* SSL: no alternative certificate subject name matches target host name 'li-astrology.com.ua'
```

GitHub has not issued SSL certificate for li-astrology.com.ua yet.

## Things Already Tried
1. ✅ Changed nameservers from BODIS (parking) to NIC.UA nameservers
2. ✅ Added all 4 GitHub Pages A records
3. ✅ Added www CNAME pointing to vinohradov.github.io.
4. ✅ CNAME file exists in repository with content: `li-astrology.com.ua`
5. ✅ Waited several hours for DNS propagation
6. ✅ Flushed Google DNS cache at developers.google.com/speed/public-dns/cache
7. ✅ Removed and re-added custom domain in GitHub Pages settings multiple times
8. ✅ Tried adding www.li-astrology.com.ua as custom domain instead
9. ✅ Added entry to /etc/hosts to verify site works (it does)

## Files in Repository
- `/CNAME` - contains `li-astrology.com.ua`
- `/index.html` - homepage
- `/intensiv/index.html` - product page
- `/kurs-aspekty/index.html` - product page

## Possible Causes
1. GitHub's internal DNS resolver may have different cached values
2. CAA records might be blocking certificate issuance (not checked)
3. Some GitHub-specific verification failing
4. Issue with apex domain vs www domain handling

## Next Steps to Try
1. Check if CAA records exist and if they allow letsencrypt/github: `dig li-astrology.com.ua CAA`
2. Try waiting 24 hours for all caches to expire
3. Contact GitHub Support
4. Try using Cloudflare as DNS proxy (they handle SSL differently)
5. Check GitHub repository settings - ensure Pages is enabled on correct branch

## Useful Links
- GitHub Pages custom domain docs: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
- GitHub Pages troubleshooting: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages
- NIC.UA DNS settings: https://nic.ua (login required)
- GitHub repo settings: https://github.com/vinohradov/li-astrology/settings/pages
