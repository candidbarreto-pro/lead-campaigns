document.getElementById('otpForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phoneInput = document.getElementById('phone');
    const submitBtn = document.getElementById('submitBtn');
    const messageDiv = document.getElementById('message');
    const phone = phoneInput.value.trim();

    // Validate 10-digit number
    if (!/^\d{10}$/.test(phone)) {
        messageDiv.textContent = 'Please enter a valid 10-digit phone number.';
        messageDiv.className = 'message error';
        return;
    }

    // UI Loading State
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    messageDiv.textContent = '';

    const formData = new FormData();
    formData.append('phone', phone);

    // Send to backend
    fetch('send_otp.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            messageDiv.textContent = 'OTP sent successfully! Please check your phone.';
            messageDiv.className = 'message success';
            phoneInput.value = ''; // Clear input on success
        } else {
            messageDiv.textContent = data.message || 'Failed to send OTP. Please try again.';
            messageDiv.className = 'message error';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        messageDiv.textContent = 'Network error. Please try again later.';
        messageDiv.className = 'message error';
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send OTP';
    });
});