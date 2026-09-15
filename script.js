const form = document.getElementById("holidayForm");
const mobileInput = document.getElementById("mobile");
const otpInline = document.getElementById("otpInline");
const otpInput = document.getElementById("otp");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const getOtpBtn = document.getElementById("getOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const otpStatus = document.getElementById("otpStatus");
const otpBadge = document.getElementById("otpBadge");
const resendTimer = document.getElementById("resendTimer");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

let otpVerified = false;
let timer = null;
let lastOtpMobile = "";

function cleanMobile() {
    mobileInput.value = mobileInput.value.replace(/\D/g, "").slice(0, 10);
    return mobileInput.value;
}

function showError(name, message) {
    const error = document.querySelector(`[data-error="${name}"]`);
    const field = document.getElementById(name);

    if (error) error.textContent = message;
    if (field) field.classList.add("invalid");
}

function clearError(name) {
    const error = document.querySelector(`[data-error="${name}"]`);
    const field = document.getElementById(name);

    if (error) error.textContent = "";
    if (field) field.classList.remove("invalid");
}

function clearAllErrors() {
    document.querySelectorAll(".error").forEach(element => {
        element.textContent = "";
    });

    document.querySelectorAll(".invalid").forEach(element => {
        element.classList.remove("invalid");
    });
}

function setFormMessage(message, type = "") {
    formMessage.textContent = message;
    formMessage.className = `form-message show ${type}`;
}

function clearFormMessage() {
    formMessage.textContent = "";
    formMessage.className = "form-message";
}

function setOtpStatus(message, type = "") {
    otpStatus.textContent = message;
    otpStatus.className = `status ${type}`;
}

function resetOtpState() {
    otpVerified = false;
    lastOtpMobile = "";
    otpInput.value = "";
    otpInput.disabled = false;
    otpBadge.textContent = "Not verified";
    otpBadge.classList.remove("verified");
    setOtpStatus("");
    resendTimer.textContent = "";
    sendOtpBtn.disabled = false;
    getOtpBtn.disabled = false;
    verifyOtpBtn.disabled = false;

    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

function startResendTimer(seconds = 60) {
    let remaining = seconds;

    sendOtpBtn.disabled = true;
    getOtpBtn.disabled = true;
    resendTimer.textContent = `Resend in ${remaining}s`;

    if (timer) clearInterval(timer);

    timer = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(timer);
            timer = null;
            sendOtpBtn.disabled = false;
            getOtpBtn.disabled = false;
            resendTimer.textContent = "";
        } else {
            resendTimer.textContent = `Resend in ${remaining}s`;
        }
    }, 1000);
}

async function postData(payload) {
    const response = await fetch("send_otp.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("Server returned an invalid response.");
    }

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

mobileInput.addEventListener("input", () => {
    const mobile = cleanMobile();
    clearError("mobile");
    clearFormMessage();

    if (mobile.length === 10) {
        otpInline.classList.add("visible");
        otpInline.setAttribute("aria-hidden", "false");

        if (lastOtpMobile !== mobile) {
            otpVerified = false;
            otpInput.value = "";
            otpInput.disabled = false;
            verifyOtpBtn.disabled = false;
            otpBadge.textContent = "Not verified";
            otpBadge.classList.remove("verified");
            setOtpStatus("");
        }

        lastOtpMobile = mobile;
    } else {
        otpInline.classList.remove("visible");
        otpInline.setAttribute("aria-hidden", "true");
        resetOtpState();
    }
});

otpInput.addEventListener("input", () => {
    otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
});

async function requestOtp() {
    const mobile = cleanMobile();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        showError("mobile", "Enter a valid 10-digit Indian mobile number.");
        return;
    }

    clearError("mobile");
    clearFormMessage();
    setOtpStatus("Sending OTP...");
    sendOtpBtn.disabled = true;
    getOtpBtn.disabled = true;

    try {
        await postData({ action: "send_otp", mobile });
        otpVerified = false;
        otpInput.disabled = false;
        verifyOtpBtn.disabled = false;
        otpBadge.textContent = "Not verified";
        otpBadge.classList.remove("verified");
        setOtpStatus("OTP sent successfully.", "success");
        startResendTimer();
        otpInput.focus();
    } catch (error) {
        setOtpStatus(error.message, "error");
        sendOtpBtn.disabled = false;
        getOtpBtn.disabled = false;
    }
}

sendOtpBtn.addEventListener("click", requestOtp);
getOtpBtn.addEventListener("click", requestOtp);

verifyOtpBtn.addEventListener("click", async () => {
    const mobile = cleanMobile();
    const otp = otpInput.value.replace(/\D/g, "").slice(0, 6);
    otpInput.value = otp;

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        setOtpStatus("Enter a valid 10-digit mobile number first.", "error");
        return;
    }

    if (otp.length !== 6) {
        setOtpStatus("Enter the 6-digit OTP, then verify.", "error");
        otpInput.focus();
        return;
    }

    verifyOtpBtn.disabled = true;
    setOtpStatus("Verifying OTP...");

    try {
        await postData({ action: "verify_otp", mobile, otp });
        otpVerified = true;
        otpBadge.textContent = "Verified";
        otpBadge.classList.add("verified");
        setOtpStatus("Mobile number verified successfully.", "success");
        otpInput.disabled = true;
        sendOtpBtn.disabled = true;
        if (timer) clearInterval(timer);
        timer = null;
        resendTimer.textContent = "";
    } catch (error) {
        otpVerified = false;
        setOtpStatus(error.message, "error");
        verifyOtpBtn.disabled = false;
    }
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    clearAllErrors();
    clearFormMessage();

    const firstName = document.getElementById("first_name").value.trim();
    const lastName = document.getElementById("last_name").value.trim();
    const dob = document.getElementById("date_of_birth").value;
    const maritalStatus = document.getElementById("maritalstatus").value;
    const mobile = cleanMobile();
    const email = document.getElementById("email").value.trim();
    const state = document.getElementById("state").value;
    const destination = document.getElementById("destination").value;
    const consent = document.getElementById("consent").checked;
    const disclaimer = document.getElementById("disclaimer").checked;

    let valid = true;

    const required = [
        ["first_name", firstName],
        ["last_name", lastName],
        ["date_of_birth", dob],
        ["maritalstatus", maritalStatus],
        ["email", email],
        ["state", state],
        ["destination", destination]
    ];

    required.forEach(([name, value]) => {
        if (!value) {
            showError(name, "This field is required.");
            valid = false;
        }
    });

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        showError("mobile", "Enter a valid 10-digit Indian mobile number.");
        valid = false;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("email", "Enter a valid email address.");
        valid = false;
    }

    if (!consent || !disclaimer) {
        showError("consent", "Please accept both declarations.");
        valid = false;
    }

    if (!otpVerified) {
        setOtpStatus("Please verify the OTP before submitting.", "error");
        otpInline.classList.add("visible");
        otpInline.setAttribute("aria-hidden", "false");
        valid = false;
    }

    if (!valid) {
        setFormMessage("Please complete the required fields and verify your mobile number.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        await postData({
            action: "submit",
            first_name: firstName,
            last_name: lastName,
            date_of_birth: dob,
            maritalstatus: maritalStatus,
            mobile,
            email,
            state,
            destination,
            consent: consent ? 1 : 0,
            disclaimer: disclaimer ? 1 : 0
        });

        setFormMessage("Your enquiry has been submitted successfully.", "success");
        form.reset();
        otpInline.classList.remove("visible");
        otpInline.setAttribute("aria-hidden", "true");
        resetOtpState();
    } catch (error) {
        setFormMessage(error.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
});
