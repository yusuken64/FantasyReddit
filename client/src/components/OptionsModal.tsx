import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    Box,
    Button,
    Typography,
    Modal,
    Stack,
    TextField,
    useTheme,
    CircularProgress,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    ToggleButton,
    ToggleButtonGroup,
    Alert,
} from "@mui/material";

interface OptionContract {
    type: "call" | "put";
    strike: number;
    expiration: string; // ISO string
    premium: number; // per share
}

interface OptionChain {
    symbol: string;
    expirations: string[];
    contracts: OptionContract[];
}

interface OptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (order: {
        symbol: string;
        type: "call" | "put";
        expiration: string;
        strike: number;
        premium: number;
        contracts: number;
        totalCost: number;
    }) => void;
    symbol: string;
    maxMoney: number;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    symbol,
    maxMoney,
}) => {
    const theme = useTheme();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [optionChain, setOptionChain] = useState<OptionChain | null>(null);

    const [type, setType] = useState<"call" | "put">("call");
    const [expiration, setExpiration] = useState<string>("");
    const [strike, setStrike] = useState<number | null>(null);
    const [contracts, setContracts] = useState(1);

    // Reset when modal opens
    useEffect(() => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_API_URL}/options/chain/${symbol}`, {
            credentials: 'include'
        })
            .then(async res => {
                if (!res.ok) throw new Error(await res.text());
                return res.json();
            })
            .then((data: OptionChain) => {
                setOptionChain(data);
                const expirations = Array.from(
                    new Set(data.contracts.map(c => c.expiration))
                ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                if (expirations.length > 0) setExpiration(expirations[0]);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [symbol]);

    // Filter contracts by expiration and type
    const filteredContracts = useMemo(() => {
        if (!optionChain) return [];
        return optionChain.contracts.filter(
            (c) => c.expiration === expiration && c.type === type
        );
    }, [optionChain, expiration, type]);

    // Current selected contract
    const selectedContract = useMemo(() => {
        if (!filteredContracts.length || strike === null) return null;
        return filteredContracts.find((c) => c.strike === strike) || null;
    }, [filteredContracts, strike]);

    // Max contracts allowed by money
    const maxContracts = useMemo(() => {
        if (!selectedContract) return 0;
        return Math.floor(maxMoney / (selectedContract.premium * 100));
    }, [selectedContract, maxMoney]);

    const totalCost = selectedContract
        ? contracts * selectedContract.premium * 100
        : 0;

    const handleConfirm = () => {
        if (!selectedContract) return;
        onConfirm({
            symbol,
            type,
            expiration,
            strike: selectedContract.strike,
            premium: selectedContract.premium,
            contracts,
            totalCost,
        });
        onClose();
    };

    return createPortal(
        <Modal open={isOpen} onClose={onClose} aria-labelledby="options-modal-title">
            <Box
                sx={{
                    position: "absolute" as const,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    bgcolor: theme.palette.background.paper,
                    p: 4,
                    borderRadius: 2,
                    minWidth: 400,
                    maxWidth: "90vw",
                    boxShadow: 24,
                }}
            >
                <Typography id="options-modal-title" variant="h6" fontWeight="bold" gutterBottom>
                    Buy Option for {symbol}
                </Typography>

                {/* Loading & error states */}
                {loading && (
                    <Stack alignItems="center" justifyContent="center" p={2}>
                        <CircularProgress />
                    </Stack>
                )}
                {error && <Alert severity="error">{error}</Alert>}

                {!loading && !error && optionChain && (
                    <Stack spacing={3}>
                        {/* Type */}
                        <FormControl>
                            <Typography variant="subtitle2" gutterBottom>Type</Typography>
                            <ToggleButtonGroup
                                value={type}
                                exclusive
                                onChange={(_, val) => val && setType(val)}
                            >
                                <ToggleButton value="call">Call</ToggleButton>
                                <ToggleButton value="put">Put</ToggleButton>
                            </ToggleButtonGroup>
                        </FormControl>

                        {/* Expiration */}
                        <FormControl fullWidth>
                            <InputLabel>Expiration</InputLabel>
                            <Select
                                value={expiration}
                                label="Expiration"
                                onChange={(e) => {
                                    setExpiration(e.target.value);
                                    setStrike(null);
                                }}
                            >
                                {/* {optionChain.expirations.map((exp) => (
                                    <MenuItem key={exp} value={exp}>
                                        {exp}
                                    </MenuItem>
                                ))} */}
                            </Select>
                        </FormControl>

                        {/* Strike */}
                        <FormControl fullWidth disabled={!filteredContracts.length}>
                            <InputLabel>Strike</InputLabel>
                            <Select
                                value={strike ?? ""}
                                label="Strike"
                                onChange={(e) => setStrike(Number(e.target.value))}
                            >
                                {filteredContracts.map((c) => (
                                    <MenuItem key={c.strike} value={c.strike}>
                                        {c.strike} @ ${c.premium.toFixed(2)} premium
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Contracts input */}
                        {selectedContract && (
                            <>
                                <TextField
                                    type="number"
                                    label="Contracts"
                                    value={contracts}
                                    inputProps={{ min: 1, max: maxContracts, step: 1 }}
                                    onChange={(e) =>
                                        setContracts(Math.max(1, Math.min(maxContracts, Number(e.target.value))))
                                    }
                                    fullWidth
                                />

                                {/* Summary */}
                                <Typography>
                                    {contracts} contract{contracts !== 1 ? "s" : ""} × ${selectedContract.premium.toFixed(2)} × 100 ={" "}
                                    <Box component="span" color={theme.palette.primary.main} fontWeight="bold">
                                        ${totalCost.toFixed(2)}
                                    </Box>
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    Max contracts by balance ${maxMoney.toFixed(2)}: {maxContracts}
                                </Typography>
                            </>
                        )}

                        {selectedContract && (
                            <>
                                <TextField
                                    type="number"
                                    label="Contracts"
                                    value={contracts}
                                    inputProps={{ min: 1, max: maxContracts, step: 1 }}
                                    onChange={(e) =>
                                        setContracts(Math.max(1, Math.min(maxContracts, Number(e.target.value))))
                                    }
                                    fullWidth
                                />

                                {/* Summary */}
                                <Typography>
                                    {contracts} contract{contracts !== 1 ? "s" : ""} × ${selectedContract.premium.toFixed(2)} × 100 ={" "}
                                    <Box component="span" color={theme.palette.primary.main} fontWeight="bold">
                                        ${totalCost.toFixed(2)}
                                    </Box>
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    Max contracts by balance ${maxMoney.toFixed(2)}: {maxContracts}
                                </Typography>

                                {/* 🔎 Extra trade info */}
                                <Box mt={2} p={2} bgcolor={theme.palette.grey[100]} borderRadius={1}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Trade Details
                                    </Typography>

                                    {/* Break-even */}
                                    <Typography variant="body2">
                                        Break-even:{" "}
                                        {type === "call"
                                            ? `$${(selectedContract.strike + selectedContract.premium).toFixed(2)}`
                                            : `$${(selectedContract.strike - selectedContract.premium).toFixed(2)}`}
                                    </Typography>

                                    {/* Max risk */}
                                    <Typography variant="body2">
                                        Max Risk (Loss): ${totalCost.toFixed(2)}
                                    </Typography>

                                    {/* Max profit */}
                                    <Typography variant="body2">
                                        Max Profit:{" "}
                                        {type === "call"
                                            ? "Unlimited"
                                            : `$${(selectedContract.strike * 100 - selectedContract.premium * 100).toFixed(2)} × ${contracts}`}
                                    </Typography>
                                </Box>
                            </>
                        )}

                        {/* Actions */}
                        <Stack direction="row" justifyContent="flex-end" spacing={2}>
                            <Button variant="outlined" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleConfirm}
                                disabled={!selectedContract || contracts < 1}
                            >
                                Confirm
                            </Button>
                        </Stack>
                    </Stack>
                )}
            </Box>
        </Modal>,
        document.body
    );
};
