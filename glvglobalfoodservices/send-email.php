<?php
header('Content-Type: application/json');
// Restrict CORS to own domain only
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (preg_match('#^https?://(www\.)?glvglobalfoodservices\.com$#i', $origin)) {
    header("Access-Control-Allow-Origin: {$origin}");
} else {
    header('Access-Control-Allow-Origin: https://glvglobalfoodservices.com');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$to      = 'info@glvglobalfoodservices.com';
$to2     = 'info@glvservicesexp.com';

// Sanitize all fields: strip tags, trim, enforce max length
function sanitize(string $val, int $max = 200): string {
    return substr(strip_tags(trim($val)), 0, $max);
}

$name    = sanitize($_POST['name']        ?? '');
$company = sanitize($_POST['company']     ?? '');
$phone   = sanitize($_POST['phone']       ?? '', 30);
$product = sanitize($_POST['product']     ?? '');
$dest    = sanitize($_POST['destination'] ?? '');
$volume  = sanitize($_POST['volume']      ?? '', 100);
$incoterm= sanitize($_POST['incoterm']    ?? '', 50);
$payment = sanitize($_POST['payment']     ?? '', 100);
$message = sanitize($_POST['message']     ?? '', 2000);

// Strict email validation — prevents header injection
$email = filter_var(trim($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
if (!$email) {
    echo json_encode(['success' => false, 'error' => 'Invalid email address']);
    exit;
}

if (!$name || !$product) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

// Strip ALL newlines from header values to block email header injection (CWE-93)
$safe_name  = preg_replace('/[\r\n\t]/', ' ', $name);
$safe_email = preg_replace('/[\r\n\t]/', '', $email);

$subject = "GLV Food Services — Cotizacion: {$product} | {$company}";

$body  = "===========================================\n";
$body .= " GLV GLOBAL FOOD SERVICES LLC - MIAMI\n";
$body .= " Nueva Solicitud de Cotizacion\n";
$body .= "===========================================\n\n";
$body .= "CONTACTO\n";
$body .= "--------\n";
$body .= "Nombre:    {$name}\n";
$body .= "Empresa:   {$company}\n";
$body .= "Email:     {$email}\n";
$body .= "WhatsApp:  {$phone}\n\n";
$body .= "PEDIDO\n";
$body .= "------\n";
$body .= "Producto:  {$product}\n";
$body .= "Destino:   {$dest}\n";
$body .= "Volumen:   {$volume}\n";
$body .= "Incoterm:  {$incoterm}\n";
$body .= "Pago:      {$payment}\n\n";
if ($message) {
    $body .= "MENSAJE ADICIONAL\n";
    $body .= "-----------------\n";
    $body .= "{$message}\n\n";
}
$body .= "-------------------------------------------\n";
$body .= "Enviado desde glvglobalfoodservices.com\n";
$body .= date('Y-m-d H:i:s T') . "\n";

// Use safe (newline-stripped) values in headers
$headers  = "From: GLV Food Services <noreply@glvglobalfoodservices.com>\r\n";
$headers .= "Reply-To: {$safe_name} <{$safe_email}>\r\n";
$headers .= "X-Mailer: GLV-QuoteForm/1.0\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = mail($to, $subject, $body, $headers);
mail($to2, $subject, $body, $headers);

if ($sent) {
    $replySubject = "GLV Global Food Services - Recibimos su solicitud / We received your request";
    $replyBody  = "Dear {$name},\n\n";
    $replyBody .= "Thank you for contacting GLV Global Food Services LLC - Miami, Florida.\n";
    $replyBody .= "We have received your inquiry for: {$product}\n\n";
    $replyBody .= "Our team will respond within 24 business hours.\n\n";
    $replyBody .= "---\n\n";
    $replyBody .= "Estimado/a {$name},\n\n";
    $replyBody .= "Gracias por contactar a GLV Global Food Services LLC - Miami, Florida.\n";
    $replyBody .= "Hemos recibido su solicitud para: {$product}\n\n";
    $replyBody .= "Nuestro equipo respondera en menos de 24 horas habiles.\n\n";
    $replyBody .= "WhatsApp CO +57 316 086 5294\n";
    $replyBody .= "WhatsApp BR +55 11 9466 10038\n";
    $replyBody .= "Email: info@glvglobalfoodservices.com\n\n";
    $replyBody .= "Where Food Moves Markets.\n";
    $replyBody .= "GLV Global Food Services LLC\n";

    $replyHeaders  = "From: GLV Global Food Services <info@glvglobalfoodservices.com>\r\n";
    $replyHeaders .= "MIME-Version: 1.0\r\n";
    $replyHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
    mail($safe_email, $replySubject, $replyBody, $replyHeaders);

    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Mail server error']);
}
