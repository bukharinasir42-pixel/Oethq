/* Complete Course landing body — extracted from client complete-course.html.
   Header/footer/sticky-bar/script removed; CTAs are wired in the React component.
   Rendered under .ccp (see complete-course.css). Do not hand-edit; regenerate. */

export const CC_HERO = `<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <span class="eyebrow eyebrow-pill">OET Complete Course</span>
      <h1>One course.<br>Five ways to <span class="blue">finish it.</span></h1>
      <p class="lede">Every plan below is the same OET Complete Course — scheduled cohort lectures across all four skills, written and scored by OET examiners and applied linguistics professors. What changes is how much practice material you get, how long you keep it, and how closely we correct your work.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#plans">Start free &mdash; no card</a>
        <a class="btn btn-ghost" href="#compare">Compare side by side</a>
      </div>
      <p class="hero-note">✦ <b>Not sure which one?</b>&nbsp;Most candidates sitting within 8 weeks start on Precision.</p>
    </div>

    <!-- SIGNATURE: the library ledger -->
    <aside class="ledger" aria-label="What your practice library grows to">
      <div class="ledger-head">
        <span class="eyebrow">Your practice library</span>
        <span class="eyebrow" style="color:#93A6C4">Elite &amp; Jumbo</span>
      </div>
      <div class="ledger-row">
        <span class="ledger-label">Reading mock tests</span>
        <span class="ledger-val"><span class="from">15</span><span class="arrow">→</span><span class="to">30</span></span>
      </div>
      <div class="ledger-row">
        <span class="ledger-label">Listening mock tests</span>
        <span class="ledger-val"><span class="from">15</span><span class="arrow">→</span><span class="to">30</span></span>
      </div>
      <div class="ledger-row">
        <span class="ledger-label">OET HQ past papers</span>
        <span class="ledger-val"><span class="from">6+6</span><span class="arrow">→</span><span class="to">12+12</span></span>
      </div>
      <p class="ledger-foot"><b>Day 45:</b> your library refreshes and doubles. Nobody runs out of unseen material mid-preparation.</p>
    </aside>
  </div>
</section>`;

export const CC_PLANS = `<section class="section" id="plans">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow eyebrow-pill">Choose your investment</span>
      <h2>Pick the plan that matches <span class="blue">your exam date.</span></h2>
      <p class="lede">Every price below is a one-time investment in US dollars, and access starts the day your cohort begins. Try the free tier first if you want to see how we teach before you invest.</p>
    </div>

    <!-- TIER 0 — FREE TRIAL -->
    <div class="free-strip">
      <div class="fs-left">
        <span class="plan-tag" style="color:var(--blue)">Tier 0 &middot; Try before you invest</span>
        <h3>Free Trial</h3>
        <div class="fs-price"><span class="fs-amt">US$0</span><span class="fs-meta">7 days of access &middot; no card required</span></div>
      </div>
      <ul class="fs-list">
        <li><span class="ic">&#10003;</span> 1 scheduled cohort lecture</li>
        <li><span class="ic">&#10003;</span> 1 Reading mock test</li>
        <li><span class="ic">&#10003;</span> 1 Listening mock test</li>
        <li><span class="ic">&#10003;</span> 1 day of live spelling</li>
        <li><span class="ic">&#10003;</span> 1 Reading Part A skill drill</li>
        <li class="no"><span class="ic">&#10005;</span> No daily podcasts, Part B &amp; C articles, past papers, cheat sheets or Pass Predictor</li>
      </ul>
      <div class="fs-cta">
        <a class="btn btn-primary btn-block" href="#enroll">Start free</a>
        <span class="fs-note">See how we teach before you invest.</span>
      </div>
    </div>

    <div class="plans">

      <!-- TIER 1 -->
      <article class="plan plan-space">
        <span class="plan-tag">Tier 1</span>
        <h3>Foundation Sprint</h3>
        <p class="plan-sub">45 days of access</p>
        <div class="price"><span class="cur">US$</span><span class="amt">187</span></div>
        <p class="price-note">Build the base, sit the exam soon.</p>
        <a class="btn btn-primary btn-block" href="#enroll">Invest now</a>
        <div class="stats">
          <div class="stat"><b>6 + 6</b><span>Reading + Listening mocks</span></div>
          <div class="stat"><b>2 + 2</b><span>OET HQ past papers</span></div>
        </div>
        <ul class="feats">
          <li><span class="ic">✓</span> Scheduled cohort lectures — all four skills</li>
          <li><span class="ic">✓</span> 6 Reading + 6 Listening OET HQ mock tests</li>
          <li><span class="ic">✓</span> 2 Reading + 2 Listening OET HQ past papers</li>
          <li><span class="ic">✓</span> 2 writing (letter) corrections</li>
          <li class="no"><span class="ic">✕</span> No cheat sheets</li>
          <li class="no"><span class="ic">✕</span> No Pass Predictor tracker</li>
          <li class="no"><span class="ic">✕</span> No daily live drills</li>
        </ul>
      </article>

      <!-- TIER 2 -->
      <article class="plan plan-space">
        <span class="plan-tag">Tier 2</span>
        <h3>Precision Engine</h3>
        <p class="plan-sub">2 months of access</p>
        <div class="price"><span class="cur">US$</span><span class="amt">331</span></div>
        <p class="price-note">Where the score actually moves.</p>
        <a class="btn btn-primary btn-block" href="#enroll">Invest now</a>
        <div class="stats">
          <div class="stat"><b>10 + 10</b><span>Reading + Listening mocks</span></div>
          <div class="stat"><b>3 + 3</b><span>OET HQ past papers</span></div>
        </div>
        <p class="inherit-note">Everything in Foundation, plus:</p>
        <ul class="feats">
          <li><span class="ic">✓</span> Daily live Reading Part A drills</li>
          <li><span class="ic">✓</span> Reading Part A skimming &amp; scanning drills</li>
          <li><span class="ic">✓</span> Listening Part A drills + daily live spelling</li>
          <li><span class="ic">✓</span> Daily reading article from official OET sources</li>
          <li><span class="ic">✓</span> Cheat sheets + lectures on how to use them</li>
          <li><span class="ic">✓</span> Speaking lectures + Speaking Hack PDFs</li>
          <li><span class="ic">✓</span> Daily podcasts</li>
          <li><span class="ic">✓</span> Pass Predictor tracker</li>
          <li><span class="ic">✓</span> 3 writing (letter) corrections</li>
        </ul>
      </article>

      <!-- TIER 3 — FEATURED -->
      <article class="plan plan-featured plan-space">
        <span class="badge badge-gold">★ Most chosen</span>
        <span class="plan-tag">Tier 3</span>
        <h3>Elite Clearance</h3>
        <p class="plan-sub">5 months of access</p>
        <div class="price"><span class="cur">US$</span><span class="amt">503</span></div>
        <p class="price-note">Room to fail a mock and still fix it.</p>
        <a class="btn btn-dark btn-block" href="#enroll">Invest now</a>
        <div class="stats">
          <div class="stat"><b>30 + 30</b><span>Reading + Listening mocks</span></div>
          <div class="stat"><b>12 + 12</b><span>OET HQ past papers</span></div>
        </div>
        <div class="refresh-chip"><span class="dot"></span> Starts at 15+15 mocks and 6+6 past papers — refreshes and doubles on day 45.</div>
        <p class="inherit-note">Everything in Precision, plus:</p>
        <ul class="feats">
          <li><span class="ic">✓</span> 30 Reading + 30 Listening mock tests in total</li>
          <li><span class="ic">✓</span> 12 Reading + 12 Listening OET HQ past papers</li>
          <li><span class="ic">✓</span> 7 writing (letter) corrections</li>
          <li><span class="ic">✓</span> WhatsApp accountability group with Dr. Nasir</li>
          <li><span class="ic">✓</span> Fresh material on day 45 — nothing recycled</li>
          <li><span class="ic">✓</span> 5 months of runway — book the exam when the data says so</li>
        </ul>
      </article>

      <!-- JUMBO -->
      <article class="plan plan-jumbo plan-space">
        <span class="badge badge-dark" style="background:#04101F;border:1px solid #2A4880">Jumbo</span>
        <span class="plan-tag">Tier 4</span>
        <h3>Total Clearance</h3>
        <p class="plan-sub">9 months of access</p>
        <div class="price"><span class="cur">US$</span><span class="amt">773</span></div>
        <p class="price-note">The whole library, start to PIN.</p>
        <a class="btn btn-primary btn-block" href="#enroll">Invest now</a>
        <div class="stats">
          <div class="stat"><b>40 + 40</b><span>Reading + Listening mocks</span></div>
          <div class="stat"><b>20 + 20</b><span>OET HQ past papers</span></div>
        </div>
        <div class="refresh-chip"><span class="dot"></span> Starts at 20+20 mocks and 10+10 past papers — refreshes and doubles on day 45.</div>
        <p class="inherit-note">Everything in Elite, plus:</p>
        <ul class="feats">
          <li><span class="ic">✓</span> 40 Reading + 40 Listening mock tests in total</li>
          <li><span class="ic">✓</span> 20 Reading + 20 Listening OET HQ past papers</li>
          <li><span class="ic">✓</span> Reading Part A core-skill programme</li>
          <li><span class="ic">✓</span> Reading Part A spelling programme</li>
          <li><span class="ic">✓</span> Daily podcasts for the full 9 months</li>
          <li><span class="ic">✓</span> 10 writing (letter) corrections</li>
          <li><span class="ic">✓</span> 9 months — covers a retake without paying twice</li>
        </ul>
      </article>

    </div>
  </div>
</section>`;

export const CC_DAY45 = `<section class="section section-dark on-dark" id="day45">
  <div class="wrap unlock">
    <div>
      <span class="eyebrow eyebrow-pill">The day 45 refresh</span>
      <h2>Most candidates fail on papers they've already <span class="blue">memorised.</span></h2>
      <p class="lede">Recycled mocks flatter your score and teach you nothing. On Elite and Jumbo, your entire practice library is replaced on day 45 with material you have never seen — written in-house by OET examiners and applied linguistics professors, calibrated to the current examiner standard.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#compare">See what refreshes</a>
      </div>
    </div>

    <div class="timeline">
      <div class="tl-track">
        <div class="tl-fill"></div>
        <span class="tl-pin" style="left:0"></span>
        <span class="tl-pin p2" style="left:45%"></span>
      </div>
      <div class="tl-caps" style="margin-top:-18px;margin-bottom:24px">
        <span>Day 1 · Library A</span>
        <span style="color:var(--gold)">Day 45 · Library B</span>
      </div>
      <div class="unlock-rows">
        <div class="u-row"><span class="u-name">Reading mock tests — Elite</span><span class="u-a">15</span><span class="u-arr">→</span><span class="u-b">30</span></div>
        <div class="u-row"><span class="u-name">Listening mock tests — Elite</span><span class="u-a">15</span><span class="u-arr">→</span><span class="u-b">30</span></div>
        <div class="u-row"><span class="u-name">OET HQ past papers — Elite</span><span class="u-a">6+6</span><span class="u-arr">→</span><span class="u-b">12+12</span></div>
        <div class="u-row"><span class="u-name">Reading mock tests — Jumbo</span><span class="u-a">20</span><span class="u-arr">→</span><span class="u-b">40</span></div>
        <div class="u-row"><span class="u-name">Listening mock tests — Jumbo</span><span class="u-a">20</span><span class="u-arr">→</span><span class="u-b">40</span></div>
        <div class="u-row"><span class="u-name">OET HQ past papers — Jumbo</span><span class="u-a">10+10</span><span class="u-arr">→</span><span class="u-b">20+20</span></div>
      </div>
    </div>
  </div>
</section>`;

export const CC_COMPARE = `<section class="section section-mist" id="compare">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow eyebrow-pill">Full comparison</span>
      <h2>Every line, <span class="blue">side by side.</span></h2>
      <p class="lede">Nothing hidden in the small print. Numbers shown as <b>start → after day 45</b> where material refreshes.</p>
    </div>

    <div class="table-shell">
      <!-- mobile plan picker -->
      <div class="mob-picker" role="group" aria-label="Choose a plan to compare">
        <button type="button" data-col="0" aria-pressed="false">Free<b>$0</b></button>
        <button type="button" data-col="1" aria-pressed="false">Tier 1<b>$187</b></button>
        <button type="button" data-col="2" aria-pressed="false">Tier 2<b>$331</b></button>
        <button type="button" data-col="3" aria-pressed="true">Tier 3<b>$503</b></button>
        <button type="button" data-col="4" aria-pressed="false">Jumbo<b>$773</b></button>
      </div>

      <div class="table-scroll">
        <table class="compare">
          <thead>
            <tr>
              <th class="feat-col" scope="col">
                <span class="col-tag">What you get</span>
                <span class="col-title">OET Complete Course</span>
              </th>
              <th scope="col" class="free-col" data-col="0">
                <span class="col-tag">Tier 0</span>
                <span class="col-title">Free Trial</span>
                <span class="col-price">US$0</span>
                <span class="col-days">7 days · no card</span>
              </th>
              <th scope="col" data-col="1">
                <span class="col-tag">Tier 1</span>
                <span class="col-title">Foundation Sprint</span>
                <span class="col-price">US$187</span>
                <span class="col-days">45 days</span>
              </th>
              <th scope="col" data-col="2">
                <span class="col-tag">Tier 2</span>
                <span class="col-title">Precision Engine</span>
                <span class="col-price">US$331</span>
                <span class="col-days">2 months</span>
              </th>
              <th scope="col" class="hl" data-col="3">
                <span class="col-tag" style="color:var(--blue)">Tier 3 · Most chosen</span>
                <span class="col-title">Elite Clearance</span>
                <span class="col-price">US$503</span>
                <span class="col-days">5 months</span>
              </th>
              <th scope="col" class="plan-jumbo-col" data-col="4">
                <span class="col-tag" style="color:#B77800">Jumbo</span>
                <span class="col-title">Total Clearance</span>
                <span class="col-price">US$773</span>
                <span class="col-days">9 months</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="row-group"><td class="feat-col" colspan="6">Access</td></tr>
            <tr>
              <td class="feat-col">Course access</td>
              <td class="free-col" data-col="0"><span class="num">7 days</span></td>
              <td data-col="1"><span class="num">45 days</span></td>
              <td data-col="2"><span class="num">2 months</span></td>
              <td class="hl" data-col="3"><span class="num">5 months</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="num">9 months</span></td>
            </tr>
            <tr>
              <td class="feat-col">Scheduled cohort lectures &mdash; all 4 skills</td>
              <td class="free-col" data-col="0"><span class="num">1 lecture</span></td>
              <td data-col="1"><span class="tick">&#10003;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr class="row-group"><td class="feat-col" colspan="6">Practice material</td></tr>
            <tr>
              <td class="feat-col">Reading mock tests</td>
              <td class="free-col" data-col="0"><span class="num">1</span></td>
              <td data-col="1"><span class="num">6</span></td>
              <td data-col="2"><span class="num">10</span></td>
              <td class="hl" data-col="3"><span class="grow"><span class="num">15</span>&rarr;<span class="g2">30</span></span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="grow"><span class="num">20</span>&rarr;<span class="g2">40</span></span></td>
            </tr>
            <tr>
              <td class="feat-col">Listening mock tests</td>
              <td class="free-col" data-col="0"><span class="num">1</span></td>
              <td data-col="1"><span class="num">6</span></td>
              <td data-col="2"><span class="num">10</span></td>
              <td class="hl" data-col="3"><span class="grow"><span class="num">15</span>&rarr;<span class="g2">30</span></span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="grow"><span class="num">20</span>&rarr;<span class="g2">40</span></span></td>
            </tr>
            <tr>
              <td class="feat-col">OET HQ past papers &mdash; Reading</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="num">2</span></td>
              <td data-col="2"><span class="num">3</span></td>
              <td class="hl" data-col="3"><span class="grow"><span class="num">6</span>&rarr;<span class="g2">12</span></span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="grow"><span class="num">10</span>&rarr;<span class="g2">20</span></span></td>
            </tr>
            <tr>
              <td class="feat-col">OET HQ past papers &mdash; Listening</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="num">2</span></td>
              <td data-col="2"><span class="num">3</span></td>
              <td class="hl" data-col="3"><span class="grow"><span class="num">6</span>&rarr;<span class="g2">12</span></span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="grow"><span class="num">10</span>&rarr;<span class="g2">20</span></span></td>
            </tr>
            <tr>
              <td class="feat-col">Library refreshes on day 45</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="cross">&#10005;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr class="row-group"><td class="feat-col" colspan="6">Daily live training</td></tr>
            <tr>
              <td class="feat-col">Daily live spelling sessions</td>
              <td class="free-col" data-col="0"><span class="num">1 day</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Daily podcasts</td>
              <td class="free-col" data-col="0"><span class="num">1 episode</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Daily live Reading Part A drills</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Reading Part A skimming &amp; scanning drills</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Listening Part A drills</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Daily reading article &mdash; official OET sources</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Reading Part A core-skill programme</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="cross">&#10005;</span></td>
              <td class="hl" data-col="3"><span class="cross">&#10005;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Reading Part A spelling programme</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="cross">&#10005;</span></td>
              <td class="hl" data-col="3"><span class="cross">&#10005;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr class="row-group"><td class="feat-col" colspan="6">Tools &amp; feedback</td></tr>
            <tr>
              <td class="feat-col">Cheat sheets</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Lectures on how to use the cheat sheets</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Speaking lectures + Speaking Hack PDFs</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">Writing (letter) corrections</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="num">2</span></td>
              <td data-col="2"><span class="num">3</span></td>
              <td class="hl" data-col="3"><span class="num">7</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="num">10</span></td>
            </tr>
            <tr>
              <td class="feat-col">Pass Predictor tracker</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="tick">&#10003;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col">WhatsApp accountability group with Dr. Nasir</td>
              <td class="free-col" data-col="0"><span class="cross">&#10005;</span></td>
              <td data-col="1"><span class="cross">&#10005;</span></td>
              <td data-col="2"><span class="cross">&#10005;</span></td>
              <td class="hl" data-col="3"><span class="tick">&#10003;</span></td>
              <td class="plan-jumbo-col" data-col="4"><span class="tick">&#10003;</span></td>
            </tr>
            <tr>
              <td class="feat-col"></td>
              <td class="free-col" data-col="0"><a class="btn btn-ghost btn-sm btn-block" href="#enroll">Start free</a></td>
              <td data-col="1"><a class="btn btn-primary btn-sm btn-block" href="#enroll">Invest</a></td>
              <td data-col="2"><a class="btn btn-primary btn-sm btn-block" href="#enroll">Invest</a></td>
              <td class="hl" data-col="3"><a class="btn btn-primary btn-sm btn-block" href="#enroll">Invest</a></td>
              <td class="plan-jumbo-col" data-col="4"><a class="btn btn-primary btn-sm btn-block" href="#enroll" style="background:var(--gold);color:#2A1B00">Invest</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="tfoot-note">All mock tests, past papers, cheat sheets and drills are produced in-house by OET examiners and applied linguistics professors, and scored against the current examiner standard.</p>
    </div>
  </div>
</section>`;

export const CC_PROOF = `<section class="section">
  <div class="wrap split">
    <div class="card-soft">
      <span class="eyebrow">Our own production</span>
      <h3 style="margin-top:12px">Written by the people who score the exam.</h3>
      <p>No scraped PDFs, no forwarded WhatsApp material, no recycled papers circulating for years. Every reading passage, listening file, cheat sheet and drill in the OET Complete Course is built in-house.</p>
      <ul class="mini-list">
        <li><span class="tick">✓</span> Authored by OET examiners</li>
        <li><span class="tick">✓</span> Reviewed by applied linguistics professors</li>
        <li><span class="tick">✓</span> Calibrated to the current examiner standard</li>
      </ul>
    </div>
    <div class="card-soft">
      <span class="eyebrow">Past paper benchmark</span>
      <div class="big-num" style="margin-top:14px">90%</div>
      <h3 style="margin-top:10px">Clear our past papers, and you clear the real one.</h3>
      <p>Candidates who pass the OET HQ past papers go on to clear the real exam 90% of the time. That is the whole point of the Pass Predictor: you stop guessing whether you're ready and book the exam only when the data says yes.</p>
      <p style="margin-top:14px;font-size:12.5px">Based on OET HQ candidate outcomes. Individual results vary.</p>
    </div>
  </div>
</section>`;

export const CC_FAQ = `<section class="section section-mist" id="faq">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow eyebrow-pill">Before you choose</span>
      <h2>Straight answers.</h2>
    </div>
    <div class="faq">
      <details class="q" open>
        <summary>Which plan should I take?</summary>
        <p>Start on the free tier for seven days if you just want to see how we teach &mdash; one lecture, one Reading mock, one Listening mock, one live spelling day and one podcast, no card needed. If your exam is within six weeks and you only need practice volume, take Foundation Sprint. If you need your score to move — Part A speed, spelling, letter structure — take Precision Engine. If you have failed before, or you want fresh material and close correction, take Elite Clearance. Jumbo is for candidates who want the entire library and a nine-month runway that covers a retake.</p>
      </details>
      <details class="q">
        <summary>What actually happens on day 45?</summary>
        <p>On Elite and Jumbo, your practice library is replaced with a second set of material you have not seen. Elite goes from 15 to 30 Reading mocks, 15 to 30 Listening mocks and 6+6 to 12+12 past papers. Jumbo goes from 20 to 40 mocks each and 10+10 to 20+20 past papers. Nothing you have already sat comes back.</p>
      </details>
      <details class="q">
        <summary>Are the lectures live or recorded?</summary>
        <p>Lectures run on a scheduled cohort timetable across all four skills, and every session is available to rewatch inside your access period. Drills, spelling sessions and the daily reading article run live on Precision, Elite and Jumbo.</p>
      </details>
      <details class="q">
        <summary>Can I upgrade after I start?</summary>
        <p>Yes. Message us on WhatsApp and you pay only the difference between your current plan and the one you're moving to. Your progress and Pass Predictor history carry over.</p>
      </details>
      <details class="q">
        <summary>How do the writing corrections work?</summary>
        <p>You submit a letter, and it comes back marked against the five OET writing criteria with the specific fixes that move you from a C+ to a B. Foundation includes 2, Precision 3, Elite 7 and Jumbo 10.</p>
      </details>
    </div>
  </div>
</section>`;

export const CC_CTA = `<section class="cta-band on-dark" id="enroll">
  <div class="wrap">
    <span class="eyebrow eyebrow-pill">Next cohort</span>
    <h2>Only invest if you're serious about clearing OET.</h2>
    <p class="lede" style="max-width:56ch">Send us your target score and exam date on WhatsApp. We'll tell you honestly which plan fits — and if none of them do, we'll say that too.</p>
    <a class="btn btn-primary" href="#plans" style="padding:15px 30px;font-size:16px">Invest now</a>
  </div>
</section>`;
