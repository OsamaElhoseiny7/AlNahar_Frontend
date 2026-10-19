// ================= =================
// 0. رابط الباك إند الأساسي
// ================= =================
const API_BASE_URL = 'http://localhost:5000/api';

// مصفوفة المراحل الـ 6 الخاصة بتشغيلات المصنع
const stageNames = [
  { ar: 'استلام وفحص الخام' },
  { ar: 'تجهيز وحل الصباغة' },
  { ar: 'مرحلة الصباغة والتلوين' },
  { ar: 'العصر والتجفيف الحراري' },
  { ar: 'الفحص والجودة النهائية' },
  { ar: 'التعبئة والتغليف والتسليم' }
];

let cart = [];
let selectedPaymentMethod = 'vf_cash';

// ================= =================
// 1. ربط تسجيل دخول الأدمن (Admin Login)
// ================= =================
async function loginAdminPortal(password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const result = await response.json();

    if (response.ok) {
      localStorage.setItem('alnahar_admin_token', result.token);
      alert('تم تسجيل الدخول بنجاح لإدارة المصنع!');
      return true;
    } else {
      alert(result.message || 'كلمة المرور غير صحيحة');
      return false;
    }
  } catch (error) {
    console.error('Admin Auth Error:', error);
    alert('تعذر الاتصال بالسيرفر. تأكد من تشغيل الباك إند (npm start)');
  }
}

// ================= =================
// 2. ربط تسجيل مستخدم جديد بالـ Backend (MongoDB)
// ================= =================
async function registerNewUserFromUI(event) {
  if (event) event.preventDefault();

  const name = document.getElementById('regName')?.value || 'مستخدم جديد';
  const email = document.getElementById('regEmail')?.value;
  const phone = document.getElementById('regPhone')?.value;
  const address = document.getElementById('regAddress')?.value;
  const company = document.getElementById('regCompany')?.value || '';
  const password = document.getElementById('regPassword')?.value;

  if (!email || !password || !phone) {
    alert('يرجى إدخال البريد الإلكتروني، كلمة المرور، ورقم الهاتف على الأقل.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        address,
        company,
        password,
        role: 'user'
      })
    });

    const result = await response.json();

    if (response.ok) {
      alert('تم إنشاء الحساب بنجاح وتسجيله في قاعدة البيانات!');
      localStorage.setItem('alnahar_user_token', result.token);
      window.location.href = 'index.html';
    } else {
      alert(result.message || 'البريد الإلكتروني مسجل مسبقاً أو حدث خطأ ما');
    }
  } catch (error) {
    console.error('Registration Error:', error);
    alert('تعذر الاتصال بالخادم. تأكد أن السيرفر يعمل على بورت 5000.');
  }
}

// ================= =================
// 3. ربط تتبع التشغيلات بالـ API (Order Tracker)
// ================= =================
async function searchBatchFromAPI() {
  const inputEl = document.getElementById('batchInput');
  const resBox = document.getElementById('trackerResult');
  const grid = document.getElementById('stagesTrackGrid');

  if (!inputEl) return;
  const code = inputEl.value.trim().toUpperCase();

  if (!code) {
    alert('من فضلك أدخل رقم التشغيلة');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/orders/track/${code}`);
    const result = await response.json();

    if (!response.ok) {
      alert(result.message || 'رقم التشغيلة غير موجود بقاعدة البيانات');
      return;
    }

    const b = result.data;

    document.getElementById('tBatchId').textContent = b.batchNumber;
    document.getElementById('tBatchSpec').textContent = b.specifications || 'سنجل جيرسيه قطن';
    document.getElementById('tBatchShade').textContent = b.colorOrDesign || '-';
    document.getElementById('tBatchDate').textContent = b.deliveryDate || 'خلال 48 ساعة';

    grid.innerHTML = '';
    stageNames.forEach((st, idx) => {
      const stepNum = idx + 1;
      let cls = '';
      let statusTxt = 'في الانتظار';

      if (stepNum < b.currentStage) {
        cls = 'done';
        statusTxt = '✓ تمت المرحلة';
      } else if (stepNum === parseInt(b.currentStage)) {
        cls = 'active';
        statusTxt = '● جاري التشغيل الآن';
      }

      grid.innerHTML += `
        <div class="step-card ${cls}">
          <div class="step-num">0${stepNum}</div>
          <div style="font-weight:800; color:var(--navy); margin-bottom:4px;">${st.ar}</div>
          <div style="font-size:0.78rem; font-weight:700;">${statusTxt}</div>
        </div>
      `;
    });

    resBox.style.display = 'block';

  } catch (error) {
    console.error('Tracking Error:', error);
    alert('حدث خطأ أثناء التتبع من السيرفر');
  }
}

// ================= =================
// 4. ربط إتمام الطلب وإنشائه في الـ DB (Checkout)
// ================= =================
async function submitOrderToBackend() {
  const nameEl = document.getElementById('custName');
  const factoryEl = document.getElementById('custFactory');
  const phoneEl = document.getElementById('custPhone');

  const name = nameEl ? nameEl.value.trim() : '';
  const factory = factoryEl ? factoryEl.value.trim() : '';
  const phone = phoneEl ? phoneEl.value.trim() : '';

  if (!name || !factory || !phone) {
    alert('يرجى كتابة الاسم واسم المصنع ورقم الهاتف.');
    return;
  }

  if (!cart || cart.length === 0) {
    alert('السلة فارغة!');
    return;
  }

  let grandTotal = 0;
  cart.forEach(item => grandTotal += item.total);

  const generatedBatchNumber = 'NH-2026-' + Math.floor(100 + Math.random() * 900);

  const payload = {
    batchNumber: generatedBatchNumber,
    clientName: `${name} (${factory})`,
    specifications: cart.map(i => `${i.title} - ${i.details}`).join(' | '),
    colorOrDesign: cart[0]?.details || 'حسب المواصفات',
    deliveryDate: 'خلال 3 إلى 5 أيام عمل',
    totalAmount: grandTotal,
    paymentMethod: selectedPaymentMethod === 'vf_cash' ? 'vodafone_cash' : 'instapay'
  };

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      alert(`تم تسجيل طلبك بنجاح في قاعدة البيانات!\nرقم التشغيلة الخاص بك لمتابعته هو: ${result.data.batchNumber}`);
      cart = [];
    } else {
      alert(result.message || 'حدث خطأ أثناء حفظ الطلب');
    }
  } catch (error) {
    console.error('Checkout API Error:', error);
    alert('تعذر حفظ الطلب في السيرفر');
  }
}