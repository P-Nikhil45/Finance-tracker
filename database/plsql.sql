CREATE OR REPLACE PACKAGE finance_tracker_pkg AS
    FUNCTION fn_category_spend (
        p_user_id IN NUMBER,
        p_category_id IN NUMBER,
        p_month IN DATE
    ) RETURN NUMBER;

    FUNCTION fn_savings_rate (
        p_user_id IN NUMBER,
        p_month IN DATE
    ) RETURN NUMBER;

    PROCEDURE pr_add_transaction (
        p_user_id IN NUMBER,
        p_account_id IN NUMBER,
        p_category_id IN NUMBER,
        p_transaction_type IN VARCHAR2,
        p_amount IN NUMBER,
        p_transaction_date IN DATE,
        p_payment_mode IN VARCHAR2,
        p_description IN VARCHAR2
    );

    PROCEDURE pr_monthly_report (
        p_user_id IN NUMBER,
        p_month IN DATE,
        p_report OUT SYS_REFCURSOR
    );
END finance_tracker_pkg;
/

CREATE OR REPLACE PACKAGE BODY finance_tracker_pkg AS
    FUNCTION fn_category_spend (
        p_user_id IN NUMBER,
        p_category_id IN NUMBER,
        p_month IN DATE
    ) RETURN NUMBER IS
        v_total NUMBER(12,2);
    BEGIN
        SELECT NVL(SUM(amount), 0)
        INTO v_total
        FROM transaction_entry
        WHERE user_id = p_user_id
          AND category_id = p_category_id
          AND transaction_type = 'EXPENSE'
          AND TRUNC(transaction_date, 'MM') = TRUNC(p_month, 'MM');

        RETURN v_total;
    END fn_category_spend;

    FUNCTION fn_savings_rate (
        p_user_id IN NUMBER,
        p_month IN DATE
    ) RETURN NUMBER IS
        v_income NUMBER(12,2);
        v_expense NUMBER(12,2);
    BEGIN
        SELECT
            NVL(SUM(CASE WHEN transaction_type = 'INCOME' THEN amount END), 0),
            NVL(SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount END), 0)
        INTO v_income, v_expense
        FROM transaction_entry
        WHERE user_id = p_user_id
          AND TRUNC(transaction_date, 'MM') = TRUNC(p_month, 'MM');

        IF v_income = 0 THEN
            RETURN 0;
        END IF;

        RETURN ROUND(((v_income - v_expense) / v_income) * 100, 2);
    END fn_savings_rate;

    PROCEDURE pr_add_transaction (
        p_user_id IN NUMBER,
        p_account_id IN NUMBER,
        p_category_id IN NUMBER,
        p_transaction_type IN VARCHAR2,
        p_amount IN NUMBER,
        p_transaction_date IN DATE,
        p_payment_mode IN VARCHAR2,
        p_description IN VARCHAR2
    ) IS
    BEGIN
        INSERT INTO transaction_entry (
            user_id,
            account_id,
            category_id,
            transaction_type,
            amount,
            transaction_date,
            payment_mode,
            description
        ) VALUES (
            p_user_id,
            p_account_id,
            p_category_id,
            UPPER(p_transaction_type),
            p_amount,
            p_transaction_date,
            UPPER(p_payment_mode),
            p_description
        );
    END pr_add_transaction;

    PROCEDURE pr_monthly_report (
        p_user_id IN NUMBER,
        p_month IN DATE,
        p_report OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN p_report FOR
            SELECT
                c.category_name,
                SUM(t.amount) AS total_spent
            FROM transaction_entry t
            JOIN category c
                ON c.category_id = t.category_id
            WHERE t.user_id = p_user_id
              AND t.transaction_type = 'EXPENSE'
              AND TRUNC(t.transaction_date, 'MM') = TRUNC(p_month, 'MM')
            GROUP BY c.category_name
            ORDER BY total_spent DESC;
    END pr_monthly_report;
END finance_tracker_pkg;
/

CREATE OR REPLACE TRIGGER trg_transaction_account_balance
AFTER INSERT OR UPDATE OR DELETE ON transaction_entry
FOR EACH ROW
BEGIN
    IF INSERTING THEN
        UPDATE account
        SET current_balance = current_balance +
            CASE
                WHEN :NEW.transaction_type = 'INCOME' THEN :NEW.amount
                ELSE -:NEW.amount
            END
        WHERE account_id = :NEW.account_id;

    ELSIF UPDATING THEN
        UPDATE account
        SET current_balance = current_balance -
            CASE
                WHEN :OLD.transaction_type = 'INCOME' THEN :OLD.amount
                ELSE -:OLD.amount
            END
        WHERE account_id = :OLD.account_id;

        UPDATE account
        SET current_balance = current_balance +
            CASE
                WHEN :NEW.transaction_type = 'INCOME' THEN :NEW.amount
                ELSE -:NEW.amount
            END
        WHERE account_id = :NEW.account_id;

    ELSIF DELETING THEN
        UPDATE account
        SET current_balance = current_balance -
            CASE
                WHEN :OLD.transaction_type = 'INCOME' THEN :OLD.amount
                ELSE -:OLD.amount
            END
        WHERE account_id = :OLD.account_id;
    END IF;
END;
/
