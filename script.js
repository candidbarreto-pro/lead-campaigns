const form = document.getElementById("holidayForm");
const mobileInput = document.getElementById("mobile");
const otpArea = document.getElementById("otpArea");
const otpInline = document.getElementById("otpInline");
const otpInput = document.getElementById("otp");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const otpStatus = document.getElementById("otpStatus");
const otpBadge = document.getElementById("otpBadge");
const otpMessage = document.getElementById("otpMessage");
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
    const errorElement = document.querySelector(
        `[data-error="${name}"]`
    );

    if (errorElement) {
        errorElement.textContent = message;
    }

    const inputElement = document.getElementById(name);

    if (inputElement) {
        inputElement.classList.add("invalid");
    }
}

function clearError(name) {
    const errorElement = document.querySelector(
        `[data-error="${name}"]`
    );

    if (errorElement) {
        errorElement.textContent = "";
    }

    const inputElement = document.getElementById(name);

    if (inputElement) {
        inputElement.classList.remove("invalid");
    }
}

function clearAllErrors() {
    document.querySelectorAll(".error").forEach(element => {
        element.textContent = "";
    });

    document.querySelectorAll(".invalid").forEach(element => {
        element.classList.remove("invalid");
    });
}

function setFormMessage(message, type) {
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

    otpMessage.textContent = "Enter the OTP sent to your mobile.";

    setOtpStatus("");

    resendTimer.textContent = "";

    sendOtpBtn.disabled = false;
    verifyOtpBtn.disabled = false;

    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

function startResendTimer(seconds = 60) {
    let remaining = seconds;

    sendOtpBtn.disabled = true;
    resendTimer.textContent = `Resend in ${remaining}s`;

    if (timer) {
        clearInterval(timer);
    }

    timer = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(timer);
            timer = null;
            sendOtpBtn.disabled = false;
            resendTimer.textContent = "";
        } else {
            resendTimer.textContent = `Resend in ${remaining}s`;
        }
    }, 1000);
}

mobileInput.addEventListener("input", () => {
    const mobile = cleanMobile();

    clearError("mobile");
    clearFormMessage();

    if (mobile.length === 10) {
        otpInline.classList.add("visible");
        otpInline.setAttribute("aria-hidden", "false");
        otpArea.setAttribute("aria-hidden", "false");

        verifyOtpBtn.disabled = false;
        sendOtpBtn.disabled = false;

        if (lastOtpMobile !== mobile) {
            otpVerified = false;
            otpInput.value = "";
            otpInput.disabled = false;
            otpBadge.textContent = "Not verified";
            otpBadge.classList.remove("verified");
            setOtpStatus("");
        }

        lastOtpMobile = mobile;
    } else {
        otpInline.classList.remove("visible");
        otpInline.setAttribute("aria-hidden", "true");
        otpArea.setAttribute("aria-hidden", "true");
        resetOtpState();
    }
});

sendOtpBtn.addEventListener("click", async () => {
    const mobile = cleanMobile();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        showError(
            "mobile",
            "Enter a valid 10-digit Indian mobile number."
        );
        return;
    }

    clearError("mobile");
    setOtpStatus("Sending OTP...");
    sendOtpBtn.disabled = true;

    try {
        const response = await fetch(
            "api/send_otp.php",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mobile: mobile
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to send OTP."
            );
        }

        setOtpStatus(
            data.message || "OTP sent successfully.",
            "success"
        );

        otpMessage.textContent =
            `A 6-digit OTP was sent to +91 ${mobile}.`;

        startResendTimer();
        otpInput.focus();
    } catch (error) {
        setOtpStatus(error.message, "error");
        sendOtpBtn.disabled = false;
    }
});

verifyOtpBtn.addEventListener("click", async () => {
    const mobile = cleanMobile();

    const otp = otpInput.value
        .replace(/\D/g, "")
        .slice(0, 6);

    otpInput.value = otp;

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        setOtpStatus(
            "Enter a valid 10-digit mobile number first.",
            "error"
        );
        return;
    }

    if (otp.length !== 6) {
        setOtpStatus(
            "Enter the 6-digit OTP, then verify.",
            "error"
        );
        otpInput.focus();
        return;
    }

    verifyOtpBtn.disabled = true;
    setOtpStatus("Verifying OTP...");

    try {
        const response = await fetch(
            "api/verify_otp.php",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mobile: mobile,
                    otp: otp
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "OTP verification failed."
            );
        }

        otpVerified = true;

        otpBadge.textContent = "Verified";
        otpBadge.classList.add("verified");

        setOtpStatus(
            "Mobile number verified successfully.",
            "success"
        );

        sendOtpBtn.disabled = true;
        otpInput.disabled = true;
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

    const mobile = cleanMobile();
    let valid = true;

    const requiredFields = [
        "first_name",
        "last_name",
        "date_of_birth",
        "email",
        "state",
        "destination"
    ];

    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);

        if (!field.value.trim()) {
            showError(
                fieldName,
                "This field is required."
            );

            valid = false;
        }
    });

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        showError(
            "mobile",
            "Enter a valid 10-digit Indian mobile number."
        );

        valid = false;
    }

    const email = document
        .getElementById("email")
        .value
        .trim();

    if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        showError(
            "email",
            "Enter a valid email address."
        );

        valid = false;
    }

    const consentChecked =
        document.getElementById("consent").checked;

    const disclaimerChecked =
        document.getElementById("disclaimer").checked;

    if (!consentChecked || !disclaimerChecked) {
        showError(
            "consent",
            "Please accept both declarations."
        );

        valid = false;
    }

    if (!otpVerified) {
        setOtpStatus(
            "Please verify the OTP before submitting.",
            "error"
        );

        otpInline.classList.add("visible");
        otpInline.setAttribute("aria-hidden", "false");

        valid = false;
    }

    if (!valid) {
        setFormMessage(
            "Please complete the required fields and verify your mobile number.",
            "error"
        );

        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const payload = {
        first_name: document
            .getElementById("first_name")
            .value
            .trim(),

        last_name: document
            .getElementById("last_name")
            .value
            .trim(),

        date_of_birth:
            document.getElementById("date_of_birth").value,

        mobile: mobile,

        email: email,

        state:
            document.getElementById("state").value,

        destination:
            document.getElementById("destination").value,

        consent: consentChecked ? 1 : 0,

        disclaimer: disclaimerChecked ? 1 : 0
    };

    try {
        const response = await fetch(
            "api/submit.php",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to submit the form."
            );
        }

        setFormMessage(
            data.message ||
            "Your holiday preferences have been submitted successfully.",
            "success"
        );

        form.reset();

        otpInline.classList.remove("visible");
        otpInline.setAttribute("aria-hidden", "true");

        otpArea.setAttribute("aria-hidden", "true");

        resetOtpState();

        window.scrollTo({
            top: 0, 
            behavior: "smooth"
        });
    } catch (error) {
        setFormMessage(
            error.message,
            "error"
        );
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
});

document.getElementById("date_of_birth").max =
    new Date().toISOString().split("T")[0];