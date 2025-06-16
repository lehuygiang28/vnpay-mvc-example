"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_handlebars_1 = require("express-handlebars");
const path_1 = require("path");
const vnpay_1 = require("vnpay");
const body_parser_1 = require("body-parser");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({ path: (0, path_1.join)(__dirname, '../.env') });
const app = (0, express_1.default)();
app.set('trust proxy', true);
if (!process.env.VNPAY_SECURE_SECRET || !process.env.VNPAY_TMN_CODE) {
    throw new Error('Missing VNPAY_SECURE_SECRET or VNPAY_TMN_CODE');
}
const vnpay = new vnpay_1.VNPay({
    secureSecret: process.env.VNPAY_SECURE_SECRET,
    tmnCode: process.env.VNPAY_TMN_CODE,
    testMode: true,
});
const hbs = (0, express_handlebars_1.engine)({ extname: 'hbs', defaultLayout: 'main', encoding: 'utf-8' });
app.engine('hbs', hbs);
app.set('view engine', 'hbs');
app.set('views', (0, path_1.join)(__dirname, '../', 'views'));
app.set('view layouts', (0, path_1.join)(__dirname, '../', 'views', 'layouts'));
app.use((0, body_parser_1.urlencoded)({ extended: true }));
app.get('/', async (req, res) => {
    const bankList = await vnpay.getBankList();
    const productTypeList = Object.entries(vnpay_1.ProductCode).map(([key, value]) => ({ key, value }));
    const contentPaymentDefault = `Thanh toan don hang ${new Date().toISOString()}`;
    return res.render('home', {
        showTitle: true,
        bankList,
        productTypeList,
        contentPaymentDefault,
    });
});
app.post('/', async (req, res) => {
    const bankList = await vnpay.getBankList();
    const productTypeList = Object.entries(vnpay_1.ProductCode).map(([key, value]) => ({ key, value }));
    const contentPaymentDefault = `Thanh toan don hang ${new Date().toISOString()}`;
    const { amountInput, contentPayment, productTypeSelect, bankSelect, langSelect } = req.body;
    if (!amountInput || amountInput <= 0) {
        return res.render('home', {
            scripts: `<script>alert('Số tiền chưa hợp lệ');window.location.href = '/';</script>`,
            bankList,
            productTypeList,
            contentPaymentDefault,
        });
    }
    if (!contentPayment) {
        return res.render('home', {
            scripts: `<script>alert('Vui lòng điền nội dung thanh toán');window.location.href = '/';</script>`,
            bankList,
            productTypeList,
            contentPaymentDefault,
        });
    }
    const data = {
        vnp_Amount: amountInput,
        vnp_IpAddr: req.headers.forwarded ||
            req.ip ||
            req.socket.remoteAddress ||
            req.connection.remoteAddress ||
            '127.0.0.1',
        vnp_OrderInfo: contentPayment,
        vnp_ReturnUrl: process.env.VNPAY_RETURN_URL ?? 'http://localhost:5000/vnpay-return',
        vnp_TxnRef: new Date().getTime().toString(),
        vnp_BankCode: bankSelect ?? undefined,
        vnp_Locale: langSelect,
        vnp_OrderType: productTypeSelect,
    };
    const url = vnpay.buildPaymentUrl(data);
    return res.redirect(url);
});
app.get('/url', async (req, res) => {
    return res.redirect('/');
});
app.post('/url', async (req, res) => {
    const bankList = await vnpay.getBankList();
    const productTypeList = Object.entries(vnpay_1.ProductCode).map(([key, value]) => ({ key, value }));
    const contentPaymentDefault = `Thanh toan don hang ${new Date().toISOString()}`;
    const { amountInput, contentPayment, productTypeSelect, bankSelect, langSelect } = req.body;
    if (!amountInput || amountInput <= 0) {
        return res.render('home', {
            scripts: `<script>alert('Số tiền chưa hợp lệ');window.location.href = '/';</script>`,
            bankList,
            productTypeList,
            contentPaymentDefault,
        });
    }
    if (!contentPayment) {
        return res.render('home', {
            scripts: `<script>alert('Vui lòng điền nội dung thanh toán');window.location.href = '/';</script>`,
            bankList,
            productTypeList,
            contentPaymentDefault,
        });
    }
    const data = {
        vnp_Amount: amountInput,
        vnp_IpAddr: req.headers.forwarded ||
            req.ip ||
            req.socket.remoteAddress ||
            req.connection.remoteAddress ||
            '127.0.0.1',
        vnp_OrderInfo: contentPayment,
        vnp_ReturnUrl: process.env.VNPAY_RETURN_URL ?? 'http://localhost:5000/vnpay-return',
        vnp_TxnRef: new Date().getTime().toString(),
        vnp_BankCode: bankSelect ?? undefined,
        vnp_Locale: langSelect,
        vnp_OrderType: productTypeSelect,
    };
    const url = vnpay.buildPaymentUrl(data);
    return res.render('home', {
        bankList,
        productTypeList,
        contentPaymentDefault,
        url,
    });
});
app.get('/vnpay-return', async (req, res) => {
    const result = vnpay.verifyReturnUrl(req.query);
    return res.render('result', {
        result: {
            ...result,
            vnp_PayDate: (0, vnpay_1.parseDate)(result.vnp_PayDate ?? 'Invalid Date').toLocaleString(),
        },
    });
});
app.get('/vnpay-ipn', async (req, res) => {
    try {
        const verify = vnpay.verifyIpnCall(req.query);
        if (!verify.isVerified) {
            return res.json(vnpay_1.IpnFailChecksum);
        }
        const foundOrder = {
            orderId: '123456',
            amount: 10000,
            status: 'pending',
        };
        if (!foundOrder || verify.vnp_TxnRef !== foundOrder.orderId) {
            return res.json(vnpay_1.IpnOrderNotFound);
        }
        if (verify.vnp_Amount !== foundOrder.amount) {
            return res.json(vnpay_1.IpnInvalidAmount);
        }
        if (foundOrder.status === 'completed') {
            return res.json(vnpay_1.InpOrderAlreadyConfirmed);
        }
        foundOrder.status = 'completed';
        return res.json(vnpay_1.IpnSuccess);
    }
    catch (error) {
        console.log(`verify error: ${error}`);
        return res.json(vnpay_1.IpnUnknownError);
    }
});
app.listen(5000, () => console.log('Server started on port 5000'));
