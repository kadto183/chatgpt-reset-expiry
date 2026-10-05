// ==UserScript==
// @name         ChatGPT Reset Expiry
// @name:zh-CN   ChatGPT 重置额度有效期查询插件
// @namespace    https://github.com/kadto183/chatgpt-reset-expiry
// @version      1.0.1
// @description  View the exact expiration time of ChatGPT reset credits in your browser's local timezone.
// @description:zh-CN 查询 ChatGPT 重置额度的准确有效期与失效时间，精确到秒并自动转换为浏览器当前时区。
// @author       kadto183
// @license      MIT
// @homepageURL  https://github.com/kadto183/chatgpt-reset-expiry
// @supportURL   https://github.com/kadto183/chatgpt-reset-expiry/issues
// @downloadURL  https://raw.githubusercontent.com/kadto183/chatgpt-reset-expiry/main/chatgpt-reset-expiry.user.js
// @updateURL    https://raw.githubusercontent.com/kadto183/chatgpt-reset-expiry/main/chatgpt-reset-expiry.user.js
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PREFIX = '[ChatGPT Reset Expiry]';

    // ---------------------------------------------------------------------
    // Data source
    // ---------------------------------------------------------------------

    const RESET_CREDITS_URL =
        '/backend-api/wham/rate-limit-reset-credits';

    const CANDIDATE_URL_RE =
        /(usage|reset|credit|limit|subscription|plan|wham|rate)/i;

    const RELATED_KEY_RE =
        /(expire|expires|expiry|expiration|reset|credit|limit|valid_until)/i;

    const HIGH_VALUE_KEY_RE =
        /(expires?_?at|expiry|expiration|reset_?at|reset_?time|valid_?until)/i;


    // ---------------------------------------------------------------------
    // Browser timezone and UI language
    // ---------------------------------------------------------------------

    const LOCAL_TIME_ZONE =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const CHINESE_TIME_ZONES = new Set([
        'Asia/Shanghai',
        'Asia/Chongqing',
        'Asia/Chungking',
        'Asia/Harbin',
        'Asia/Urumqi',
        'Asia/Kashgar',
        'Asia/Hong_Kong',
        'Asia/Macau',
        'Asia/Taipei'
    ]);

    const IS_CHINESE_ZONE =
        CHINESE_TIME_ZONES.has(LOCAL_TIME_ZONE);

    const UI_LANG =
        IS_CHINESE_ZONE ? 'zh' : 'en';

    const UI_LOCALE =
        IS_CHINESE_ZONE ? 'zh-CN' : 'en-US';

    const CHINESE_ZONE_NAMES = {
        'Asia/Shanghai': '中国标准时间',
        'Asia/Chongqing': '中国标准时间',
        'Asia/Chungking': '中国标准时间',
        'Asia/Harbin': '中国标准时间',
        'Asia/Urumqi': '中国乌鲁木齐时间',
        'Asia/Kashgar': '中国喀什时间',
        'Asia/Hong_Kong': '中国香港时间',
        'Asia/Macau': '中国澳门时间',
        'Asia/Taipei': '中国台湾时间'
    };


    // ---------------------------------------------------------------------
    // Localized UI text
    // ---------------------------------------------------------------------

    const TEXT = {
        zh: {
            title: 'GPT 重置额度有效期查询',
            subtitle: '查询额度具体到几点失效',
            waiting: '正在检测当前页面…',
            found: count => `已找到 ${count} 个重置额度`,
            empty: '当前尚未检测到重置额度',
            credit: index => `重置额度 ${index}`,
            nearest: '最近到期',
            expired: '已失效',
            copy: '复制全部时间',
            copied: '已复制',
            clear: '清空记录',
            other: '其他检测结果',
            noOther: '暂无其他检测结果',
            source: '数据来源',
            timezone: '当前时区',
            toggle: '展开或收起',
            close: '关闭'
        },

        en: {
            title: 'GPT Reset Credits',
            subtitle: 'View the exact expiration time',
            waiting: 'Checking the current page…',
            found: count =>
                `${count} reset credit${count === 1 ? '' : 's'} found`,
            empty: 'No reset credits detected on this page',
            credit: index => `Reset Credit ${index}`,
            nearest: 'Expires Next',
            expired: 'Expired',
            copy: 'Copy All Times',
            copied: 'Copied',
            clear: 'Clear',
            other: 'Other Detected Results',
            noOther: 'No other results',
            source: 'Data source',
            timezone: 'Current time zone',
            toggle: 'Expand or collapse',
            close: 'Close'
        }
    };

    const T = TEXT[UI_LANG];


    // ---------------------------------------------------------------------
    // Runtime state
    // ---------------------------------------------------------------------

    const resetCredits = new Map();
    const otherMatches = new Map();

    let panel = null;
    let mainList = null;
    let otherList = null;
    let statusEl = null;

    // Start quietly. The panel only auto-opens after real reset-credit data
    // has been detected.
    let isExpanded = false;
    let userCollapsed = false;
    let autoExpandedOnce = false;
    let dismissed = false;


    // ---------------------------------------------------------------------
    // Time helpers
    // ---------------------------------------------------------------------

    function parseDate(value) {
        if (value === null || value === undefined) {
            return null;
        }

        let date = null;

        if (typeof value === 'number') {
            if (value > 1e9 && value < 1e11) {
                date = new Date(value * 1000);
            } else if (value >= 1e11 && value < 1e15) {
                date = new Date(value);
            }
        }

        if (typeof value === 'string') {
            const text = value.trim();

            if (/^\d{10}$/.test(text)) {
                date = new Date(Number(text) * 1000);
            } else if (/^\d{13}$/.test(text)) {
                date = new Date(Number(text));
            } else {
                const timestamp = Date.parse(text);
                if (!Number.isNaN(timestamp)) {
                    date = new Date(timestamp);
                }
            }
        }

        if (!date || Number.isNaN(date.getTime())) {
            return null;
        }

        const year = date.getUTCFullYear();

        if (year < 2020 || year > 2100) {
            return null;
        }

        return date;
    }


    function getDateParts(date) {
        const parts =
            new Intl.DateTimeFormat(
                'en-CA',
                {
                    timeZone: LOCAL_TIME_ZONE,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hourCycle: 'h23'
                }
            ).formatToParts(date);

        const result = {};

        for (const part of parts) {
            if (part.type !== 'literal') {
                result[part.type] = part.value;
            }
        }

        return result;
    }


    function formatDateOnly(date) {
        const p = getDateParts(date);
        return `${p.year}/${p.month}/${p.day}`;
    }


    function formatTimeOnly(date) {
        const p = getDateParts(date);
        return `${p.hour}:${p.minute}:${p.second}`;
    }


    function formatLocal(date) {
        return `${formatDateOnly(date)} ${formatTimeOnly(date)}`;
    }


    function getUtcOffset(date) {
        try {
            const parts =
                new Intl.DateTimeFormat(
                    'en-US',
                    {
                        timeZone: LOCAL_TIME_ZONE,
                        timeZoneName: 'longOffset'
                    }
                ).formatToParts(date);

            const zone =
                parts.find(
                    part => part.type === 'timeZoneName'
                )?.value;

            if (zone) {
                return zone.replace('GMT', 'UTC');
            }
        } catch (_) {}

        // LOCAL_TIME_ZONE comes from the browser/system, so this fallback
        // remains correct for the browser's active local timezone.
        const offsetMinutes = -date.getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const absolute = Math.abs(offsetMinutes);

        const hours =
            String(
                Math.floor(absolute / 60)
            ).padStart(2, '0');

        const minutes =
            String(
                absolute % 60
            ).padStart(2, '0');

        return `UTC${sign}${hours}:${minutes}`;
    }


    function getTimeZoneDisplayName(date) {
        if (
            IS_CHINESE_ZONE &&
            CHINESE_ZONE_NAMES[LOCAL_TIME_ZONE]
        ) {
            return CHINESE_ZONE_NAMES[LOCAL_TIME_ZONE];
        }

        try {
            const parts =
                new Intl.DateTimeFormat(
                    UI_LOCALE,
                    {
                        timeZone: LOCAL_TIME_ZONE,
                        timeZoneName: 'long'
                    }
                ).formatToParts(date);

            const zoneName =
                parts.find(
                    part => part.type === 'timeZoneName'
                )?.value;

            if (zoneName) {
                return zoneName;
            }
        } catch (_) {}

        return LOCAL_TIME_ZONE;
    }


    function formatTimeZoneLabel(date) {
        return (
            `${getTimeZoneDisplayName(date)} · ` +
            `${getUtcOffset(date)}`
        );
    }


    function getCurrentZoneSummary() {
        return formatTimeZoneLabel(new Date());
    }


    // ---------------------------------------------------------------------
    // DOM helpers
    // ---------------------------------------------------------------------

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }


    function applyExpandedState() {
        if (!panel) {
            return;
        }

        panel.classList.toggle(
            'grf-expanded',
            isExpanded
        );

        panel.classList.toggle(
            'grf-collapsed',
            !isExpanded
        );

        const toggleButton =
            panel.querySelector('#grf-toggle');

        if (toggleButton) {
            toggleButton.textContent =
                isExpanded ? '−' : '+';
        }
    }


    function setExpanded(expanded, byUser = false) {
        isExpanded = expanded;

        if (byUser) {
            userCollapsed = !expanded;
        }

        applyExpandedState();
    }


    function maybeAutoExpand() {
        if (
            dismissed ||
            userCollapsed ||
            autoExpandedOnce ||
            resetCredits.size === 0
        ) {
            return;
        }

        autoExpandedOnce = true;
        setExpanded(true, false);
    }


    // ---------------------------------------------------------------------
    // UI
    // ---------------------------------------------------------------------

    function createPanel() {
        if (
            panel ||
            !document.documentElement
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.textContent = `
        #gpt-reset-finder-panel {
            position: fixed;
            top: 76px;
            right: 20px;
            z-index: 2147483647;
            color: #f0f0f0;
            background: rgba(24,24,24,.97);
            border: 1px solid rgba(255,255,255,.11);
            border-radius: 15px;
            box-shadow: 0 16px 45px rgba(0,0,0,.35);
            font-family: "Microsoft YaHei", "Segoe UI", system-ui,
                         -apple-system, sans-serif;
            overflow: hidden;
            backdrop-filter: blur(14px);
            transition: width .18s ease, border-radius .18s ease;
        }

        #gpt-reset-finder-panel.grf-collapsed {
            width: 174px;
            border-radius: 12px;
        }

        #gpt-reset-finder-panel.grf-collapsed #grf-body {
            display: none;
        }

        #gpt-reset-finder-panel.grf-collapsed #grf-header {
            padding: 9px 9px 9px 11px;
            border-bottom: 0;
            cursor: pointer;
        }

        #gpt-reset-finder-panel.grf-collapsed #grf-title {
            font-size: 12px;
        }

        #gpt-reset-finder-panel.grf-collapsed #grf-subtitle {
            display: none;
        }

        #gpt-reset-finder-panel.grf-collapsed #grf-close {
            display: none;
        }

        #gpt-reset-finder-panel.grf-expanded {
            width: 410px;
            max-height: 76vh;
        }

        #grf-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 14px 12px;
            border-bottom: 1px solid rgba(255,255,255,.075);
            background:
                linear-gradient(
                    180deg,
                    rgba(255,255,255,.038),
                    rgba(255,255,255,0)
                );
            user-select: none;
        }

        #grf-title-wrap {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        #grf-title-line {
            display: flex;
            align-items: center;
            gap: 7px;
        }

        #grf-title {
            font-size: 15px;
            font-weight: 650;
            letter-spacing: .2px;
        }

        #grf-mini-count {
            min-width: 17px;
            height: 17px;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
            border-radius: 999px;
            background: rgba(236,188,72,.14);
            border: 1px solid rgba(236,188,72,.24);
            color: #e5c467;
            font-size: 9px;
        }

        #grf-mini-count.grf-visible {
            display: inline-flex;
        }

        #grf-subtitle {
            font-size: 11px;
            color: #8d8d8d;
        }

        #grf-header-actions {
            display: flex;
            gap: 4px;
        }

        .grf-icon-btn {
            width: 29px;
            height: 29px;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: #999;
            cursor: pointer;
            font-size: 16px;
        }

        .grf-icon-btn:hover {
            background: rgba(255,255,255,.075);
            color: #eee;
        }

        #grf-body {
            max-height: calc(76vh - 60px);
            overflow-y: auto;
        }

        #grf-overview {
            padding: 12px 14px 5px;
        }

        #grf-status {
            font-size: 12px;
            color: #999;
        }

        #grf-current-zone {
            margin-top: 5px;
            font-size: 10px;
            color: #666;
        }

        #grf-main-list {
            padding: 4px 12px 11px;
        }

        .grf-card {
            position: relative;
            margin-top: 9px;
            padding: 12px 13px 13px;
            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.047),
                    rgba(255,255,255,.018)
                );
            border: 1px solid rgba(255,255,255,.095);
            border-radius: 11px;
        }

        .grf-card:hover {
            border-color: rgba(255,255,255,.16);
        }

        .grf-card.grf-nearest {
            border-color: rgba(236,188,72,.48);
            background:
                linear-gradient(
                    145deg,
                    rgba(236,188,72,.085),
                    rgba(255,255,255,.018)
                );
            box-shadow:
                inset 2px 0 0 rgba(236,188,72,.72);
        }

        .grf-card.grf-expired {
            opacity: .48;
        }

        .grf-card-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .grf-card-name {
            font-size: 12px;
            color: #b7b7b7;
        }

        .grf-badge,
        .grf-expired-label {
            padding: 2px 7px;
            border-radius: 999px;
            font-size: 10px;
        }

        .grf-badge {
            background: rgba(236,188,72,.12);
            border: 1px solid rgba(236,188,72,.25);
            color: #e5c467;
        }

        .grf-expired-label {
            background: rgba(255,255,255,.035);
            border: 1px solid rgba(255,255,255,.07);
            color: #888;
        }

        .grf-date-row {
            display: flex;
            align-items: baseline;
            gap: 12px;
            white-space: nowrap;
        }

        .grf-date {
            font-size: 18px;
            font-weight: 650;
            color: #f1f1f1;
            font-variant-numeric: tabular-nums;
        }

        .grf-time {
            font-size: 18px;
            font-weight: 650;
            color: #efc969;
            font-family: "SFMono-Regular", Consolas, monospace;
            font-variant-numeric: tabular-nums;
        }

        .grf-zone {
            margin-top: 6px;
            color: #7f7f7f;
            font-size: 10.5px;
        }

        #grf-actions {
            display: flex;
            gap: 7px;
            padding: 0 12px 12px;
        }

        .grf-action-btn {
            flex: 1;
            padding: 7px 10px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(255,255,255,.043);
            color: #ccc;
            cursor: pointer;
            font-size: 12px;
        }

        .grf-action-btn:hover {
            background: rgba(255,255,255,.075);
            color: #f2f2f2;
        }

        #grf-other-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            border-top: 1px solid rgba(255,255,255,.07);
            color: #808080;
            font-size: 11px;
            cursor: pointer;
            user-select: none;
        }

        #grf-other-header:hover {
            background: rgba(255,255,255,.025);
        }

        #grf-other-list {
            display: none;
            padding: 0 14px 12px;
            max-height: 220px;
            overflow-y: auto;
        }

        .grf-other-item {
            padding: 8px 0;
            border-top: 1px solid rgba(255,255,255,.055);
            color: #858585;
            font-size: 10px;
            line-height: 1.55;
            word-break: break-all;
        }

        .grf-other-key {
            color: #7fa9d8;
        }

        .grf-empty {
            padding: 19px 10px;
            text-align: center;
            color: #727272;
            font-size: 12px;
        }

        #grf-footer {
            padding: 0 14px 12px;
            color: #555;
            font-size: 9px;
            line-height: 1.5;
            word-break: break-all;
        }
        `;

        document.documentElement.appendChild(style);

        panel =
            document.createElement('div');

        panel.id =
            'gpt-reset-finder-panel';

        panel.className =
            'grf-collapsed';

        panel.innerHTML = `
            <div id="grf-header">
                <div id="grf-title-wrap">
                    <div id="grf-title-line">
                        <div id="grf-title">
                            ${escapeHtml(T.title)}
                        </div>
                        <span id="grf-mini-count">0</span>
                    </div>
                    <div id="grf-subtitle">
                        ${escapeHtml(T.subtitle)}
                    </div>
                </div>

                <div id="grf-header-actions">
                    <button
                        class="grf-icon-btn"
                        id="grf-toggle"
                        title="${escapeHtml(T.toggle)}"
                    >+</button>

                    <button
                        class="grf-icon-btn"
                        id="grf-close"
                        title="${escapeHtml(T.close)}"
                    >×</button>
                </div>
            </div>

            <div id="grf-body">
                <div id="grf-overview">
                    <div id="grf-status">
                        ${escapeHtml(T.waiting)}
                    </div>

                    <div id="grf-current-zone">
                        ${escapeHtml(T.timezone)}:
                        ${escapeHtml(getCurrentZoneSummary())}
                    </div>
                </div>

                <div id="grf-main-list">
                    <div class="grf-empty">
                        ${escapeHtml(T.empty)}
                    </div>
                </div>

                <div id="grf-actions">
                    <button
                        class="grf-action-btn"
                        id="grf-copy"
                    >${escapeHtml(T.copy)}</button>

                    <button
                        class="grf-action-btn"
                        id="grf-clear"
                    >${escapeHtml(T.clear)}</button>
                </div>

                <div id="grf-other-header">
                    <span>${escapeHtml(T.other)}</span>
                    <span>
                        <span id="grf-other-count">0</span>
                        <span id="grf-other-arrow">▾</span>
                    </span>
                </div>

                <div id="grf-other-list"></div>

                <div id="grf-footer">
                    ${escapeHtml(T.source)}:
                    /backend-api/wham/rate-limit-reset-credits
                </div>
            </div>
        `;

        document.documentElement.appendChild(panel);

        mainList =
            panel.querySelector('#grf-main-list');

        otherList =
            panel.querySelector('#grf-other-list');

        statusEl =
            panel.querySelector('#grf-status');


        panel
            .querySelector('#grf-header')
            .addEventListener(
                'click',
                event => {
                    if (
                        event.target.closest('#grf-close') ||
                        event.target.closest('#grf-toggle')
                    ) {
                        return;
                    }

                    setExpanded(!isExpanded, true);
                }
            );


        panel
            .querySelector('#grf-toggle')
            .onclick = event => {
                event.stopPropagation();
                setExpanded(!isExpanded, true);
            };


        panel
            .querySelector('#grf-close')
            .onclick = event => {
                event.stopPropagation();
                dismissed = true;
                panel.style.display = 'none';
            };


        panel
            .querySelector('#grf-clear')
            .onclick = () => {
                resetCredits.clear();
                otherMatches.clear();
                render();
            };


        panel
            .querySelector('#grf-other-header')
            .onclick = () => {
                const isOpen =
                    otherList.style.display === 'block';

                otherList.style.display =
                    isOpen ? 'none' : 'block';

                const arrow =
                    panel.querySelector('#grf-other-arrow');

                arrow.textContent =
                    isOpen ? '▾' : '▴';
            };


        panel
            .querySelector('#grf-copy')
            .onclick =
                copyResetTimes;

        applyExpandedState();
    }


    function ensurePanel() {
        if (panel) {
            return;
        }

        if (document.documentElement) {
            createPanel();
        } else {
            document.addEventListener(
                'DOMContentLoaded',
                createPanel,
                { once: true }
            );
        }
    }


    // ---------------------------------------------------------------------
    // Reset-credit extraction
    // ---------------------------------------------------------------------

    function extractResetCredits(obj, url) {
        if (
            !obj ||
            typeof obj !== 'object'
        ) {
            return;
        }

        function walk(value, path = 'root') {
            if (
                !value ||
                typeof value !== 'object'
            ) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach(
                    (item, index) => {
                        if (
                            item &&
                            typeof item === 'object' &&
                            'expires_at' in item
                        ) {
                            const date =
                                parseDate(item.expires_at);

                            if (date) {
                                const uniqueKey =
                                    date.toISOString();

                                resetCredits.set(
                                    uniqueKey,
                                    {
                                        date,
                                        raw: item.expires_at,
                                        path:
                                            `${path}[${index}].expires_at`,
                                        parent: item,
                                        url
                                    }
                                );
                            }
                        }

                        walk(
                            item,
                            `${path}[${index}]`
                        );
                    }
                );

                return;
            }

            for (
                const [key, child]
                of Object.entries(value)
            ) {
                walk(
                    child,
                    `${path}.${key}`
                );
            }
        }

        walk(obj);
        render();

        // Secondary candidate fields never trigger this. Only confirmed
        // reset-credit data from the dedicated endpoint may auto-open.
        maybeAutoExpand();
    }


    // ---------------------------------------------------------------------
    // Secondary candidate scan
    // ---------------------------------------------------------------------

    function scanOther(
        value,
        url,
        path = 'root',
        depth = 0
    ) {
        if (
            depth > 20 ||
            value === null ||
            value === undefined
        ) {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(
                (item, index) => {
                    scanOther(
                        item,
                        url,
                        `${path}[${index}]`,
                        depth + 1
                    );
                }
            );

            return;
        }

        if (typeof value !== 'object') {
            return;
        }

        for (
            const [key, child]
            of Object.entries(value)
        ) {
            const currentPath =
                `${path}.${key}`;

            if (HIGH_VALUE_KEY_RE.test(key)) {
                const date =
                    parseDate(child);

                if (date) {
                    const id =
                        `${url}|${currentPath}|${date.toISOString()}`;

                    otherMatches.set(
                        id,
                        {
                            path: currentPath,
                            raw: child,
                            date,
                            url
                        }
                    );
                }
            }

            scanOther(
                child,
                url,
                currentPath,
                depth + 1
            );
        }

        render();
    }


    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    function getSortedCredits() {
        return Array
            .from(resetCredits.values())
            .sort(
                (a, b) =>
                    a.date.getTime() -
                    b.date.getTime()
            );
    }


    function render() {
        ensurePanel();

        if (
            !mainList ||
            !otherList
        ) {
            setTimeout(render, 50);
            return;
        }

        const credits =
            getSortedCredits();

        const now =
            Date.now();

        const miniCount =
            panel.querySelector('#grf-mini-count');

        miniCount.textContent =
            credits.length;

        miniCount.classList.toggle(
            'grf-visible',
            credits.length > 0
        );

        const futureCredits =
            credits.filter(
                item =>
                    item.date.getTime() > now
            );

        const nearest =
            futureCredits.length
                ? futureCredits[0]
                : null;


        if (!credits.length) {
            statusEl.textContent =
                T.waiting;

            mainList.innerHTML = `
                <div class="grf-empty">
                    ${escapeHtml(T.empty)}
                </div>
            `;
        } else {
            statusEl.textContent =
                T.found(credits.length);

            mainList.innerHTML =
                credits
                    .map(
                        (item, index) => {
                            const isNearest =
                                item === nearest;

                            const expired =
                                item.date.getTime() <= now;

                            return `
                                <div
                                    class="
                                        grf-card
                                        ${isNearest ? 'grf-nearest' : ''}
                                        ${expired ? 'grf-expired' : ''}
                                    "
                                >
                                    <div class="grf-card-top">
                                        <span class="grf-card-name">
                                            ${escapeHtml(T.credit(index + 1))}
                                        </span>

                                        ${
                                            isNearest
                                                ? `
                                                    <span class="grf-badge">
                                                        ${escapeHtml(T.nearest)}
                                                    </span>
                                                  `
                                                : expired
                                                    ? `
                                                        <span class="grf-expired-label">
                                                            ${escapeHtml(T.expired)}
                                                        </span>
                                                      `
                                                    : ''
                                        }
                                    </div>

                                    <div class="grf-date-row">
                                        <span class="grf-date">
                                            ${escapeHtml(
                                                formatDateOnly(item.date)
                                            )}
                                        </span>

                                        <span class="grf-time">
                                            ${escapeHtml(
                                                formatTimeOnly(item.date)
                                            )}
                                        </span>
                                    </div>

                                    <div class="grf-zone">
                                        ${escapeHtml(
                                            formatTimeZoneLabel(item.date)
                                        )}
                                    </div>
                                </div>
                            `;
                        }
                    )
                    .join('');
        }


        const others =
            Array.from(otherMatches.values());

        panel
            .querySelector('#grf-other-count')
            .textContent =
                others.length;

        otherList.innerHTML =
            others.length
                ? others
                    .map(
                        item => `
                            <div class="grf-other-item">
                                <div>
                                    <span class="grf-other-key">
                                        ${escapeHtml(item.path)}
                                    </span>
                                </div>

                                <div>
                                    ${escapeHtml(
                                        formatLocal(item.date)
                                    )}
                                </div>

                                <div>
                                    ${escapeHtml(
                                        formatTimeZoneLabel(item.date)
                                    )}
                                </div>

                                <div>
                                    ${escapeHtml(item.url)}
                                </div>
                            </div>
                        `
                    )
                    .join('')
                : `
                    <div class="grf-empty">
                        ${escapeHtml(T.noOther)}
                    </div>
                `;
    }


    // ---------------------------------------------------------------------
    // Clipboard
    // ---------------------------------------------------------------------

    async function copyResetTimes() {
        const credits =
            getSortedCredits();

        if (!credits.length) {
            return;
        }

        const text =
            credits
                .map(
                    (item, index) =>
                        `${T.credit(index + 1)}: ` +
                        `${formatLocal(item.date)} ` +
                        `(${formatTimeZoneLabel(item.date)})`
                )
                .join('\n');

        try {
            await navigator.clipboard
                .writeText(text);

            const button =
                panel.querySelector('#grf-copy');

            const originalText =
                button.textContent;

            button.textContent =
                T.copied;

            setTimeout(
                () => {
                    button.textContent =
                        originalText;
                },
                1200
            );
        } catch (_) {
            console.log(
                PREFIX,
                '\n' + text
            );
        }
    }


    // ---------------------------------------------------------------------
    // Response inspection
    // ---------------------------------------------------------------------

    function inspectResponse(text, url) {
        if (!text) {
            return;
        }

        let obj;

        try {
            obj = JSON.parse(text);
        } catch (_) {
            return;
        }

        if (url.includes(RESET_CREDITS_URL)) {
            console.log(
                PREFIX,
                'Reset credits detected'
            );

            extractResetCredits(
                obj,
                url
            );

            return;
        }

        // Avoid recursively scanning every JSON payload ChatGPT receives.
        if (!CANDIDATE_URL_RE.test(url)) {
            return;
        }

        const raw =
            JSON.stringify(obj);

        if (RELATED_KEY_RE.test(raw)) {
            scanOther(
                obj,
                url
            );
        }
    }


    // ---------------------------------------------------------------------
    // Hook fetch
    // ---------------------------------------------------------------------

    const originalFetch =
        window.fetch;

    if (originalFetch) {
        window.fetch =
            async function (...args) {
                const response =
                    await originalFetch.apply(
                        this,
                        args
                    );

                try {
                    let url = '';

                    if (
                        typeof args[0] === 'string'
                    ) {
                        url = args[0];
                    } else if (args[0]?.url) {
                        url = args[0].url;
                    }

                    const cloned =
                        response.clone();

                    cloned
                        .text()
                        .then(
                            text => {
                                inspectResponse(
                                    text,
                                    url
                                );
                            }
                        )
                        .catch(() => {});
                } catch (_) {}

                return response;
            };
    }


    // ---------------------------------------------------------------------
    // Hook XMLHttpRequest
    // ---------------------------------------------------------------------

    const XHR =
        window.XMLHttpRequest;

    if (XHR) {
        const originalOpen =
            XHR.prototype.open;

        const originalSend =
            XHR.prototype.send;

        XHR.prototype.open =
            function (
                method,
                url,
                ...rest
            ) {
                this.__grf_url =
                    String(url);

                return originalOpen.call(
                    this,
                    method,
                    url,
                    ...rest
                );
            };

        XHR.prototype.send =
            function (...args) {
                this.addEventListener(
                    'load',
                    function () {
                        try {
                            if (
                                typeof this.responseText ===
                                'string'
                            ) {
                                inspectResponse(
                                    this.responseText,
                                    this.__grf_url || ''
                                );
                            }
                        } catch (_) {}
                    }
                );

                return originalSend.apply(
                    this,
                    args
                );
            };
    }


    // ---------------------------------------------------------------------
    // Start
    // ---------------------------------------------------------------------

    ensurePanel();

    console.log(
        PREFIX,
        'v1.0.1 started',
        {
            timeZone: LOCAL_TIME_ZONE,
            language: UI_LANG,
            initialState: 'collapsed'
        }
    );
})();
