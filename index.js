const Apify = require('apify');
const puppeteer = require('puppeteer');
const Proxy = require('http-mitm-proxy');
const Promise = require('bluebird');
const { promisify } = require('util');

const { exec } = require('child_process');

const execPromise = promisify(exec);

const wait = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const setupProxy = async (port) => {
  // Setup chromium certs directory
  await execPromise('mkdir -p $HOME/.pki/nssdb');
  await execPromise('certutil -d sql:$HOME/.pki/nssdb -N');
  const proxy = Proxy();
  proxy.use(Proxy.wildcard);
  proxy.use(Proxy.gunzip);
  return new Promise((resolve, reject) => {
    proxy.listen({ port, silent: true }, (err) => {
      if (err) return reject(err);
      // Add CA certificate to chromium and return initialized proxy object
      execPromise('certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n mitm-ca -i ./.http-mitm-proxy/certs/ca.pem')
        .then(() => resolve(proxy))
        .catch(reject);
    });
  });
}

Apify.main(async () => {
  let browser;
  let proxy;
  try {
    // Initialize local MITM Proxy
    const proxy = await setupProxy(8000);

    // Do not block requests when we are opening the initial page
    let blockRequests = false;

    // Setup blocking of requests in proxy
    proxy.onRequest((context, callback) => {
      if (blockRequests) {
        const request = context.clientToProxyRequest;
        // Log out blocked requests
        console.log('Blocked request:', request.headers.host, request.url);

        // Close the connection with custom content
        context.proxyToClientResponse.end('Blocked');
        return;
      }
      return callback();
    });

    // Launch puppeteer with local proxy
    browser = await puppeteer.launch({ args: [ '--no-sandbox', '--proxy-server=localhost:8000' ]});

    const page = await browser.newPage();

    // Close new pages when they open, so that we don't memory leak
    browser.on('targetcreated', async (target) => {
      const page = await target.page();
      if (page) {
        await wait(1000);
        await page.close();
      }
    })

    await page.goto('https://google.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    await wait(2000);

    // Page is loaded, block any further requests
    blockRequests = true;

    // Middle click on any link
    await page.click('a', { button: 'middle' });

    await wait(1000);
    blockRequests = false;

    // Wait to give the browser time to open the page
    await wait(5000);
  } catch (error) {
    console.log(error);
  }


  // Close proxy and browser (not realy needed, since we end here)
  if (proxy) proxy.close();
  if (browser) await browser.close();
});
